'use client'

import { useEffect, useRef, useState } from 'react'
import type { TimelineItem } from '@/lib/types'
import { Button } from '@/components/ui/primitives'

/**
 * The way out of a letter we could not read (SPEC-FINAL §3): plain words about
 * what happened, then two doors — type it in, or take it again. Both hand the
 * document id back to the feed, which watches it the same way it watches a
 * fresh upload.
 */
export function NeedsALookPanel({
  item,
  onAdded,
  onClose,
}: {
  item: TimelineItem
  onAdded: (documentIds: string[]) => void
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  async function typeItIn() {
    const transcript = text.trim()
    if (!transcript) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/documents/${item.id}/transcript`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript }),
      })
      if (!res.ok) throw new Error(await failure(res))
      onAdded([item.id])
      onClose()
    } catch (e) {
      if (!live.current) return
      setError(e instanceof Error ? e.message : 'That did not send. Try again in a moment.')
      setBusy(false)
    }
  }

  async function retake(files: FileList | null) {
    const picked = files?.[0]
    if (!picked) return
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('personId', item.personId)
      form.append('kind', picked.type === 'application/pdf' ? 'pdf' : 'letter_photo')
      form.append('file', picked)
      const res = await fetch('/api/documents', { method: 'POST', body: form })
      const body = (await res.json().catch(() => null)) as
        | { documentId?: string; error?: { message?: string } }
        | null
      if (!res.ok) throw new Error(body?.error?.message ?? 'That photo did not go through.')

      // Retire the unreadable one into the new photo. Without this the story
      // keeps an amber card saying it could not read a letter it can now read,
      // and nothing in the app can ever clear it.
      if (body?.documentId) {
        await fetch(`/api/documents/${item.id}/merge`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ action: 'merge', duplicateOfId: body.documentId }),
        }).catch(() => {})
      }

      onAdded(body?.documentId ? [body.documentId] : [])
      onClose()
    } catch (e) {
      if (!live.current) return
      setError(e instanceof Error ? e.message : 'That photo did not go through.')
      setBusy(false)
    } finally {
      if (file.current) file.current.value = ''
    }
  }

  return (
    <>
      <h2 className="text-[17px] font-semibold leading-[1.3]">Needs a look</h2>
      <p className="mt-2 text-[15px] leading-[1.45]">
        We could not read this one. It happens with faint print, or a photo taken at an angle.
        Nothing is lost — the original is still here.
      </p>

      <div className="mt-5">
        <label htmlFor="hh-typed" className="text-[15px] font-medium">
          Type what it says
        </label>
        <p className="mt-1 text-[13px] leading-[1.4] text-[var(--hh-secondary)]">
          The main lines are enough — the date, who wrote it, and what changed.
        </p>
        <textarea
          id="hh-typed"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-2 w-full rounded-[10px] border border-[var(--hh-hairline)] bg-[var(--hh-card)] p-3 text-[15px] leading-[1.45]"
          placeholder="Dear Mr…"
        />
        <Button className="mt-2" onClick={typeItIn} disabled={busy || !text.trim()}>
          {busy ? 'Sending…' : 'Send it in'}
        </Button>
      </div>

      <div className="mt-5 border-t border-[var(--hh-hairline)] pt-4">
        <p className="text-[15px] font-medium">Take another photo</p>
        <p className="mt-1 text-[13px] leading-[1.4] text-[var(--hh-secondary)]">
          Flat on a table, good light, no shadow across the page.
        </p>
        {/* Driven entirely by the button below, so it stays out of the tab
            order rather than announcing itself as a second, unnamed control. */}
        <input
          ref={file}
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => retake(e.target.files)}
        />
        <Button
          variant="ghost"
          className="mt-2"
          onClick={() => file.current?.click()}
          disabled={busy}
        >
          Take another photo
        </Button>
      </div>

      {error && <p className="mt-3 text-[13px] text-[var(--hh-red)]">{error}</p>}
    </>
  )
}

async function failure(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
  return body?.error?.message ?? 'That did not send. Try again in a moment.'
}
