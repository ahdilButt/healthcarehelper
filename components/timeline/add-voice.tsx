'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, Square } from 'lucide-react'
import { Meta } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

/**
 * The third door (SPEC-FINAL §3): a 30-second voice note.
 *
 * The words are transcribed on the device while you speak, and the audio is
 * uploaded alongside them — which is why the pipeline needs no speech service
 * of its own, and why a note still becomes facts when the network is slow.
 *
 * If the browser cannot transcribe (Firefox, older Safari), the recording is
 * still kept and lands as "Needs a look" with its audio attached, where it can
 * be typed in. Losing the recording would be worse than transcribing it late.
 */

const MAX_SECONDS = 90

type Recognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onerror: (() => void) | null
}

function speechRecogniser(): Recognition | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  if (!Ctor) return null
  const r = new Ctor()
  r.continuous = true
  r.interimResults = true
  r.lang = 'en-GB'
  return r
}

export function AddVoiceButton({
  personId,
  onAdded,
}: {
  personId: string
  onAdded: (documentIds: string[]) => void
}) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [heard, setHeard] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const recogniser = useRef<Recognition | null>(null)
  const finalText = useRef('')
  const stopRef = useRef<() => void>(() => {})
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      recorder.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  // The clock and the cut-off live in the same timer: a note that runs past the
  // limit stops itself rather than filling the upload with silence.
  useEffect(() => {
    if (!recording) return
    let elapsed = 0
    const timer = setInterval(() => {
      elapsed += 1
      setSeconds(elapsed)
      if (elapsed >= MAX_SECONDS) stopRef.current()
    }, 1000)
    return () => clearInterval(timer)
  }, [recording])

  const upload = useCallback(
    async (audio: Blob, transcript: string) => {
      setBusy(true)
      try {
        const form = new FormData()
        form.append('personId', personId)
        form.append('kind', 'voice_note')
        form.append('audio', new File([audio], `voice-note-${Date.now()}.webm`, { type: audio.type }))
        if (transcript.trim()) form.append('transcript', transcript.trim())

        const res = await fetch('/api/documents', { method: 'POST', body: form })
        const body = (await res.json().catch(() => null)) as
          | { documentId?: string; error?: { message?: string } }
          | null
        if (!res.ok) throw new Error(body?.error?.message ?? 'That did not send.')
        onAdded(body?.documentId ? [body.documentId] : [])
      } catch (e) {
        if (live.current) setError(e instanceof Error ? e.message : 'That did not send.')
      } finally {
        if (live.current) {
          setBusy(false)
          setHeard('')
          setSeconds(0)
        }
      }
    },
    [personId, onAdded]
  )

  const stop = useCallback(() => {
    recorder.current?.stop()
    recogniser.current?.stop()
    setRecording(false)
  }, [])

  useEffect(() => {
    stopRef.current = stop
  }, [stop])

  async function start() {
    setError('')
    finalText.current = ''
    setHeard('')
    setSeconds(0)

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('We could not reach the microphone. Check the permission and try again.')
      return
    }

    chunks.current = []
    const rec = new MediaRecorder(stream)
    recorder.current = rec
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data)
    }
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const audio = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' })
      if (audio.size) void upload(audio, finalText.current)
    }
    rec.start()

    const r = speechRecogniser()
    if (r) {
      recogniser.current = r
      r.onresult = (e) => {
        let interim = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const said = e.results[i][0].transcript
          if (e.results[i].isFinal) finalText.current += `${said} `
          else interim += said
        }
        if (live.current) setHeard(`${finalText.current}${interim}`.trim())
      }
      // A failed recogniser must not stop the recording; the audio still lands.
      r.onerror = () => {}
      try {
        r.start()
      } catch {
        recogniser.current = null
      }
    }

    setRecording(true)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={busy}
        aria-pressed={recording}
        className={cn(
          'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors disabled:opacity-50',
          recording
            ? 'bg-alert text-primary-foreground'
            : 'border border-border bg-card text-foreground active:bg-muted'
        )}
      >
        {recording ? <Square className="size-4" /> : <Mic className="size-4" />}
        {busy ? 'Adding…' : recording ? `Stop · ${seconds}s` : 'Record a note'}
      </button>

      {recording && (
        <Meta className="max-w-[26ch] text-right">
          {heard ? `“${heard}”` : 'Listening — say what happened.'}
        </Meta>
      )}
      {error && <p className="text-[13px] text-alert">{error}</p>}
    </div>
  )
}
