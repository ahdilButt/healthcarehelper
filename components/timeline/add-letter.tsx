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
  onAdded: () => void
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
    try {
      for (const file of Array.from(files)) {
        const kind = file.type === 'application/pdf' ? 'pdf' : 'letter_photo'
        const form = new FormData()
        form.append('personId', personId)
        form.append('kind', kind)
        form.append('file', file)
        const res = await fetch('/api/documents', { method: 'POST', body: form })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error?.message ?? 'Upload failed.')
        }
      }
      onAdded()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
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
        onChange={(e) => upload(e.target.files)}
      />
      <Button onClick={() => input.current?.click()} disabled={busy}>
        {busy ? 'Adding…' : 'Add a letter'}
      </Button>
      {error && <p className="text-[13px] text-[var(--hh-red)]">{error}</p>}
    </div>
  )
}
