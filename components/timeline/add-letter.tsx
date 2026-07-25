'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/primitives'

/**
 * Camera-first, never a data-entry form (SPEC-FINAL §3).
 * `capture="environment"` opens the rear camera straight away on a phone.
 */
export function AddLetterButton({
  personId,
  onAdded,
  autoOpen = false,
}: {
  personId: string
  /** The ids just created, so the feed can watch them settle. */
  onAdded: (documentIds: string[]) => void
  autoOpen?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const opened = useRef(false)

  useEffect(() => {
    if (autoOpen && !opened.current) {
      opened.current = true
      input.current?.click()
    }
  }, [autoOpen])

  async function upload(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError('')
    // Ids are handed over even if a later file fails — the ones that landed are real.
    const ids: string[] = []
    try {
      for (const file of Array.from(files)) {
        const kind = file.type === 'application/pdf' ? 'pdf' : 'letter_photo'
        const form = new FormData()
        form.append('personId', personId)
        form.append('kind', kind)
        form.append('file', file)
        const res = await fetch('/api/documents', { method: 'POST', body: form })
        const body = (await res.json().catch(() => null)) as
          | { documentId?: string; error?: { message?: string } }
          | null
        if (!res.ok) throw new Error(body?.error?.message ?? 'Upload failed.')
        if (body?.documentId) ids.push(body.documentId)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
      if (ids.length) onAdded(ids)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        multiple
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => upload(e.target.files)}
      />
      <Button onClick={() => input.current?.click()} disabled={busy}>
        {busy ? 'Adding…' : 'Add a letter'}
      </Button>
      {error && <p className="text-[13px] text-alert">{error}</p>}
    </div>
  )
}
