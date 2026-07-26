/**
 * Text to speech (SPEC-FINAL §11, the stretch lane's first step).
 *
 * Used for the line at the top of Today and for the voice surface on Ask —
 * "one brain, two mouths". The brain is unchanged: whatever is spoken here was
 * produced by the same /api/ask that writes the chat, under the same product
 * law, citing the same letters.
 *
 * Every caller is member-guarded and length-capped, because each character is
 * a credit off somebody's account.
 */

/** Low latency beats fidelity for a button someone taps in front of a room. */
const MODEL = 'eleven_flash_v2_5'

/** A warm, mid-range British voice. Overridable without a code change. */
const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM'

export const SPEECH_MAX_CHARS = 700

export function speechConfigured(): boolean {
  const key = process.env.ELEVENLABS_API_KEY
  return Boolean(key && key.trim().length > 20)
}

export async function speak(text: string): Promise<ArrayBuffer | null> {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) return null

  const voice = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json' },
    body: JSON.stringify({
      text: text.slice(0, SPEECH_MAX_CHARS),
      model_id: MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.75, speed: 0.95 },
    }),
  })

  if (!res.ok) {
    // No PII in logs: the status is enough to tell a bad key from a bad voice.
    console.error(`[speech] elevenlabs ${res.status}`)
    return null
  }
  return res.arrayBuffer()
}
