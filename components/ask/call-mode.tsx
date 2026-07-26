'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, X } from 'lucide-react'
import { useSpeech } from '@/lib/speech/use-speech'
import { cn } from '@/lib/utils'

/**
 * Ask, spoken (SPEC-FINAL §5, §11).
 *
 * The same brain as the chat — the same /api/ask, the same record, the same
 * product law, the same citations underneath — with the screen taken away.
 * One brain, two mouths.
 *
 * Everything here is sized for someone who is not wearing their reading
 * glasses: one control, one line of text, no chrome. The only thing to know is
 * that the big circle listens.
 */

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking'

/** Long enough to gather a thought, short enough not to feel abandoned. */
const SILENCE_MS = 2200

interface Recognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}

function recogniser(): Recognition | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition
    webkitSpeechRecognition?: new () => Recognition
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  if (!Ctor) return null
  const r = new Ctor()
  r.continuous = true
  r.interimResults = true
  r.lang = 'en-GB'
  return r
}

const OPENING = 'Ask me anything about the letters. What would you like to know?'

export function CallMode({
  personId,
  personName,
  onClose,
}: {
  personId: string
  personName: string
  onClose: () => void
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [heard, setHeard] = useState('')
  const [reply, setReply] = useState('')
  const [error, setError] = useState('')
  const [conversationId, setConversationId] = useState<string | null>(null)

  const { say, stop: stopSpeaking } = useSpeech(personId)
  const rec = useRef<Recognition | null>(null)
  const finalText = useRef('')
  const silence = useRef<ReturnType<typeof setTimeout> | null>(null)
  const live = useRef(true)
  const askRef = useRef<(q: string) => void>(() => {})

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      if (silence.current) clearTimeout(silence.current)
      rec.current?.abort()
    }
  }, [])

  const listen = useCallback(() => {
    setError('')
    setHeard('')
    finalText.current = ''

    const r = recogniser()
    if (!r) {
      setError('This browser cannot listen. Use the typing tab instead.')
      return
    }
    rec.current = r

    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const said = e.results[i][0].transcript
        if (e.results[i].isFinal) finalText.current += `${said} `
        else interim += said
      }
      if (live.current) setHeard(`${finalText.current}${interim}`.trim())

      // Silence is the end of a question. Nobody should have to find a button
      // to say "I have finished talking now".
      if (silence.current) clearTimeout(silence.current)
      silence.current = setTimeout(() => {
        const question = finalText.current.trim()
        r.stop()
        if (question) askRef.current(question)
        else if (live.current) setPhase('idle')
      }, SILENCE_MS)
    }

    r.onerror = (e) => {
      if (!live.current) return
      // "no-speech" is somebody thinking, not a fault.
      if (e?.error === 'no-speech') return
      setError('The microphone stopped. Tap to try again.')
      setPhase('idle')
    }

    try {
      r.start()
      setPhase('listening')
    } catch {
      setError('The microphone is busy. Tap to try again.')
      setPhase('idle')
    }
  }, [])

  const ask = useCallback(
    (question: string) => {
      setPhase('thinking')
      setReply('')

      fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personId, conversationId, question, spoken: true }),
      })
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as {
            conversationId?: string
            message?: { content: string }
            error?: { message?: string }
          } | null
          if (!res.ok || !body?.message) {
            throw new Error(body?.error?.message ?? 'I could not answer that just now.')
          }
          if (!live.current) return
          setConversationId(body.conversationId ?? conversationId)

          // The answer already arrived written to be heard, so it is spoken
          // whole. The cap is a seatbelt, not the plan.
          const spoken = firstSentences(body.message.content, 4)
          setReply(spoken)
          setPhase('speaking')
          void say(spoken, () => {
            if (live.current) setPhase('idle')
          })
        })
        .catch((e: unknown) => {
          if (!live.current) return
          setError(e instanceof Error ? e.message : 'That did not work.')
          setPhase('idle')
        })
    },
    [personId, conversationId, say]
  )

  useEffect(() => {
    askRef.current = ask
  }, [ask])

  const begin = useCallback(() => {
    void say(OPENING, () => {
      if (live.current) listen()
    })
    setPhase('speaking')
  }, [say, listen])

  const tap = () => {
    if (phase === 'idle') {
      if (reply || heard) listen()
      else begin()
      return
    }
    // Any other state: stop everything and go quiet.
    if (silence.current) clearTimeout(silence.current)
    rec.current?.abort()
    stopSpeaking()
    setPhase('idle')
  }

  const caption =
    phase === 'listening'
      ? heard || 'Listening…'
      : phase === 'thinking'
        ? 'Looking through the letters…'
        : phase === 'speaking'
          ? reply || OPENING
          : reply || `Tap to talk about ${personName}’s care`

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background px-6 py-10">
      <div className="flex w-full justify-end">
        <button
          type="button"
          onClick={() => {
            stopSpeaking()
            rec.current?.abort()
            onClose()
          }}
          className="flex size-12 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        >
          <X className="size-7" />
          <span className="sr-only">End the call</span>
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-10">
        <button
          type="button"
          onClick={tap}
          aria-label={phase === 'idle' ? 'Start talking' : 'Stop'}
          className={cn(
            'relative flex size-44 items-center justify-center rounded-full transition-colors',
            phase === 'listening' ? 'bg-primary' : 'bg-accent-deep'
          )}
        >
          {phase !== 'idle' && (
            <span
              aria-hidden
              className={cn(
                'absolute inset-0 rounded-full',
                phase === 'listening' ? 'bg-primary/30' : 'bg-accent-deep/30',
                'animate-ping'
              )}
            />
          )}
          <Mic className="relative size-16 text-white" strokeWidth={1.6} />
        </button>

        <p
          aria-live="polite"
          className="max-w-[24rem] text-center text-[22px] leading-[1.4] font-medium text-balance"
        >
          {caption}
        </p>
      </div>

      <div className="flex min-h-12 flex-col items-center gap-2">
        {error && <p className="text-[15px] text-alert">{error}</p>}
        <p className="text-center text-[13px] text-muted-foreground">
          Explains and prepares questions — never diagnoses.
        </p>
      </div>
    </div>
  )
}

/** Spoken answers stop at the point the ear stops following. */
function firstSentences(text: string, count: number): string {
  const clean = text.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim()
  const parts = clean.match(/[^.!?]+[.!?]+/g)
  if (!parts) return clean
  return parts.slice(0, count).join(' ').trim()
}
