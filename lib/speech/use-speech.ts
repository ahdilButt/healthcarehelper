'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Say something, in the best voice available.
 *
 * ElevenLabs first; the browser's own voice if there is no key, no credit, or
 * no network. A demo must never have a dead button — a worse voice is a far
 * better outcome than silence, and the words are identical either way.
 */
export function useSpeech(personId: string) {
  const [speaking, setSpeaking] = useState(false)
  const audio = useRef<HTMLAudioElement | null>(null)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      audio.current?.pause()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const stop = useCallback(() => {
    audio.current?.pause()
    audio.current = null
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setSpeaking(false)
  }, [])

  const browserVoice = useCallback((text: string, done?: () => void) => {
    if (!('speechSynthesis' in window)) {
      setSpeaking(false)
      done?.()
      return
    }
    const said = new SpeechSynthesisUtterance(text)
    said.rate = 0.95
    said.lang = 'en-GB'
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang === 'en-GB')
    if (voice) said.voice = voice
    const finish = () => {
      if (live.current) setSpeaking(false)
      done?.()
    }
    said.onend = finish
    said.onerror = finish
    window.speechSynthesis.speak(said)
  }, [])

  const say = useCallback(
    async (text: string, done?: () => void) => {
      stop()
      if (!text.trim()) return
      setSpeaking(true)

      try {
        const res = await fetch('/api/speech', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ personId, text }),
        })
        if (!res.ok) throw new Error('no voice')

        const url = URL.createObjectURL(await res.blob())
        const player = new Audio(url)
        audio.current = player
        const finish = () => {
          URL.revokeObjectURL(url)
          if (live.current) setSpeaking(false)
          done?.()
        }
        player.onended = finish
        player.onerror = finish
        await player.play()
      } catch {
        if (live.current) browserVoice(text, done)
      }
    },
    [personId, stop, browserVoice]
  )

  return { say, stop, speaking }
}
