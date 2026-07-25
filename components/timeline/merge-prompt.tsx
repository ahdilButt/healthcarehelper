'use client'

import { useEffect, useState } from 'react'
import { humanDocName, shortDate } from '@/lib/timeline/build'
import { Button, Card, CardHeader } from '@/components/ui/primitives'

interface DocumentBody {
  document: { docType: string | null; docDate: string | null; sender: string | null }
}

/**
 * The gentle merge prompt (SPEC-FINAL §3) — a card in the feed, never a modal,
 * and merge is the default. The sentence names the other letter the way the
 * timeline names it, so it is recognisable rather than a reference number.
 */
export function MergePrompt({
  documentId,
  duplicateOfId,
  label,
  onResolved,
}: {
  documentId: string
  duplicateOfId: string
  /** Named by the server where it already knew; fetched here where it did not. */
  label?: string
  onResolved: () => void
}) {
  const [name, setName] = useState(label ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (label) return
    let live = true
    fetch(`/api/documents/${duplicateOfId}`)
      .then((res) => (res.ok ? (res.json() as Promise<DocumentBody>) : null))
      .then((body) => {
        if (!live || !body) return
        const what = humanDocName(body.document.docType, body.document.sender)
        const when = body.document.docDate ? shortDate(body.document.docDate) : null
        setName(when ? `${what} from ${when}` : what)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [duplicateOfId, label])

  async function resolve(action: 'merge' | 'keep') {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/documents/${documentId}/merge`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(action === 'merge' ? { action, duplicateOfId } : { action }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(body?.error?.message ?? 'That did not save. Try again in a moment.')
      }
      onResolved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try again in a moment.')
      setBusy(false)
    }
  }

  return (
    <Card className="mb-3 border-[var(--hh-accent)]/40">
      <CardHeader>Is this the same letter?</CardHeader>
      <p className="mt-1 text-[15px] leading-[1.45]">
        This looks like the {name || 'letter'} you already added — merge them, or keep both?
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={() => resolve('merge')} disabled={busy}>
          {busy ? 'Saving…' : 'Merge them'}
        </Button>
        <Button variant="ghost" onClick={() => resolve('keep')} disabled={busy}>
          Keep both
        </Button>
      </div>
      {error && <p className="mt-2 text-[13px] text-[var(--hh-red)]">{error}</p>}
    </Card>
  )
}
