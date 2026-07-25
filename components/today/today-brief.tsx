'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CalendarDays, Check, Square, Volume2 } from 'lucide-react'

export interface Brief {
  sentence: string
  diary: string
  remaining: number
  total: number
}

/**
 * The panel above Today (SPEC-FINAL §6).
 *
 * One idea per card is the rule, and this card's idea is "here is your day":
 * the sentence, then the diary line, and a speaker that reads both aloud.
 *
 * Deep accent rather than the usual apricot because white body text needs
 * 4.5:1 and the apricot cannot carry it — #a8410f measures 6.13:1.
 *
 * It loads after the list on purpose. The medicine round has to be tappable
 * immediately; a sentence that waits on a language model must not hold it up,
 * and if the sentence never arrives the screen is still complete.
 */
export function TodayBrief({ personId, dateLabel }: { personId: string; dateLabel: string }) {
  const [brief, setBrief] = useState<Brief | null>(null)
  const [speaking, setSpeaking] = useState(false)
  const live = useRef(true)

  // Read once, on the client, rather than through state — the server has no
  // speechSynthesis, so deciding this during render would disagree with the
  // first paint.
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  useEffect(() => {
    fetch(`/api/today/${personId}/brief`)
      .then((res) => (res.ok ? (res.json() as Promise<Brief>) : null))
      .then((body) => {
        if (live.current && body) setBrief(body)
      })
      .catch(() => {})
  }, [personId])

  const speak = useCallback(() => {
    if (!brief) return
    const synth = window.speechSynthesis
    if (speaking) {
      synth.cancel()
      setSpeaking(false)
      return
    }

    synth.cancel()
    const said = new SpeechSynthesisUtterance(`${brief.sentence} ${brief.diary}`)
    // A shade under natural pace: this is read to someone doing something else.
    said.rate = 0.95
    said.pitch = 1
    said.lang = 'en-GB'
    const voice = synth.getVoices().find((v) => v.lang === 'en-GB')
    if (voice) said.voice = voice
    said.onend = () => live.current && setSpeaking(false)
    said.onerror = () => live.current && setSpeaking(false)

    setSpeaking(true)
    synth.speak(said)
  }, [brief, speaking])

  const done = brief ? brief.total > 0 && brief.remaining === 0 : false

  return (
    <section
      aria-label="Today at a glance"
      className="flex items-start gap-4 rounded-2xl bg-accent-deep px-5 py-6 text-white"
    >
      {canSpeak && (
        <button
          type="button"
          onClick={speak}
          disabled={!brief}
          aria-label={speaking ? 'Stop reading' : 'Read today aloud'}
          className="mt-1 flex size-12 shrink-0 items-center justify-center rounded-full bg-white/15 transition-colors active:bg-white/25 disabled:opacity-40"
        >
          {speaking ? <Square className="size-5" /> : <Volume2 className="size-6" />}
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium tracking-[0.08em] text-white/70 uppercase">
          {dateLabel}
        </p>

        {brief ? (
          <p className="mt-2 text-[20px] leading-[1.35] font-semibold text-balance">
            {brief.sentence}
          </p>
        ) : (
          // Holds the height so the list below does not jump when it arrives.
          <span className="mt-3 block h-6 w-4/5 animate-pulse rounded-full bg-white/20" />
        )}

        <div className="mt-4 flex items-start gap-2.5 border-t border-white/20 pt-4">
          <span className="mt-[2px] shrink-0" aria-hidden>
            {done ? <Check className="size-[18px]" /> : <CalendarDays className="size-[18px]" />}
          </span>
          {brief ? (
            <p className="text-[15px] leading-[1.45] text-white/90 text-pretty">{brief.diary}</p>
          ) : (
            <span className="block h-4 w-3/5 animate-pulse rounded-full bg-white/20" />
          )}
        </div>
      </div>
    </section>
  )
}
