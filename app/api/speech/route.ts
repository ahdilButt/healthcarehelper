import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { SPEECH_MAX_CHARS, speak, speechConfigured } from '@/lib/speech/elevenlabs'
import { USAGE, budgets, refund, reserve } from '@/lib/usage/meter'

/**
 * POST /api/speech — say something out loud.
 *
 * Member-guarded and capped: every character is a credit off somebody's
 * account, so this is not an open text-to-speech endpoint. It is deliberately
 * dumb — it speaks what it is given and decides nothing — because everything
 * worth deciding was decided by the brain that produced the words.
 */
export const POST = route(async (req: Request) => {
  const body = await readJson<{ personId?: string; text?: string }>(req)
  const personId = String(required(body.personId, 'personId'))
  const text = String(required(body.text, 'text')).trim()

  if (!text) throw new ApiError('invalid_input', 'Nothing to say.')
  if (text.length > SPEECH_MAX_CHARS) {
    throw new ApiError('invalid_input', 'That is too long to read out.')
  }

  await requireMember(personId)

  if (!speechConfigured()) {
    // The caller falls back to the browser's own voice, so this is a fact
    // rather than a failure.
    throw new ApiError('not_found', 'No voice is configured.')
  }

  // ElevenLabs bills per character, and the length is known before the money
  // is spent — so this is reserved up front and the ceiling holds exactly.
  // Over budget is not an error worth showing: useSpeech hears any non-OK
  // answer and speaks the same words in the browser's own voice.
  if (!(await reserve(USAGE.speechChars, text.length, budgets().speechChars))) {
    console.error('[speech] character budget spent — falling back to the browser voice')
    throw new ApiError('rate_limited', 'The voice budget for this demo is spent.')
  }

  const audio = await speak(text)
  if (!audio) {
    // Nothing was said, so nothing should have been charged.
    await refund(USAGE.speechChars, text.length)
    throw new ApiError('processing_failed', 'Could not read that out.')
  }

  return new Response(audio as BodyInit, {
    headers: {
      'content-type': 'audio/mpeg',
      'cache-control': 'private, no-store',
    },
  })
})
