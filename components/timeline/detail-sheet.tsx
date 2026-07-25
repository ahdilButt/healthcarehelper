'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { FactDetail, FactField, FactTable, TimelineItem } from '@/lib/types'
import {
  Button,
  EditedMark,
  FieldRow,
  Meta,
  SourceChip,
  Spinner,
  UnconfirmedBadge,
} from '@/components/ui/primitives'
import { NeedsALookPanel } from './needs-a-look'

interface DocumentBody {
  document: {
    id: string
    status: string
    docType: string | null
    docDate: string | null
    sender: string | null
  }
}

/**
 * One sheet, three faces (SPEC-FINAL §4): a fact you can check and fix, a
 * letter you can look at, and a photo we could not read. Every face ends at
 * the same place — the original letter.
 */
export function DetailSheet({
  item,
  onClose,
  onChanged,
  onAdded,
}: {
  item: TimelineItem
  onClose: () => void
  onChanged: () => void
  /** Only the timeline can take a retake or a typed-in letter; Ask opens the
   * same sheet from a source chip and has nowhere to put one. */
  onAdded?: (documentIds: string[]) => void
}) {
  return (
    <Sheet label={item.humanTitle} onClose={onClose}>
      {item.factTable ? (
        <FactPanel item={item} table={item.factTable} onChanged={onChanged} />
      ) : item.itemType === 'needs_look' && onAdded ? (
        <NeedsALookPanel item={item} onAdded={onAdded} onClose={onClose} />
      ) : (
        <LetterPanel item={item} />
      )}

      <div className="mt-5 flex flex-col gap-2">
        <a
          href={`/api/documents/${item.sourceChip.documentId}/file`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--hh-hairline)] px-5 text-[15px] font-medium"
        >
          View the original letter
        </a>
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    </Sheet>
  )
}

/**
 * Bottom sheet with the modal manners: focuses itself, closes on Escape or a
 * tap outside, and hands focus back to whatever opened it.
 *
 * It lives here rather than in primitives.tsx because primitives is imported
 * by server components — a hook in that module would break their build.
 */
export function Sheet({
  label,
  onClose,
  children,
}: {
  label: string
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const close = useRef(onClose)

  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close.current()
        return
      }
      // Tab must not walk out onto the cards behind the scrim, where the focus
      // ring is invisible and Enter would swap this sheet for another fact.
      if (e.key !== 'Tab' || !panel.current) return
      const stops = panel.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (!stops.length) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      const on = document.activeElement
      if (e.shiftKey && (on === first || on === panel.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && on === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (opener && document.contains(opener)) opener.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/30"
      onClick={() => close.current()}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className="hh-shell max-h-[85dvh] w-full overflow-y-auto rounded-t-[16px] bg-[var(--hh-card)] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

function FactPanel({
  item,
  table,
  onChanged,
}: {
  item: TimelineItem
  table: FactTable
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<FactDetail | null>(null)
  const [fixing, setFixing] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  // Settled in a promise callback rather than an async body so the first load
  // is never a synchronous setState inside the effect below.
  const load = useCallback(
    () =>
      apiJson<FactDetail>(`/api/facts/${table}/${item.id}`).then(
        (body) => {
          if (!live.current) return
          setDetail(body)
          setError('')
        },
        (e: unknown) => {
          if (live.current) setError(humanError(e))
        }
      ),
    [table, item.id]
  )

  useEffect(() => {
    void load()
  }, [load])

  async function confirmFact() {
    setBusy(true)
    setError('')
    try {
      await apiJson<{ confirmedAt: string }>(`/api/facts/${table}/${item.id}/confirm`, {
        method: 'POST',
      })
      await load()
      if (live.current) onChanged()
    } catch (e) {
      if (live.current) setError(humanError(e))
    } finally {
      if (live.current) setBusy(false)
    }
  }

  async function saveFix(field: string, value: string) {
    setBusy(true)
    setError('')
    try {
      await apiJson(`/api/facts/${table}/${item.id}/correct`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ field, value }),
      })
      await load()
      if (!live.current) return
      setFixing(null)
      onChanged()
    } catch (e) {
      if (live.current) setError(humanError(e))
    } finally {
      if (live.current) setBusy(false)
    }
  }

  if (!detail) {
    return error ? (
      <p className="text-[15px] text-[var(--hh-red)]">{error}</p>
    ) : (
      <Spinner label="Getting the details…" />
    )
  }

  const { fact } = detail

  return (
    <>
      <h2 className="text-[17px] font-semibold leading-[1.3]">{fact.humanTitle}</h2>
      <p className="mt-1 text-[15px] leading-[1.45]">{detail.displayValue}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <SourceChip label={item.sourceChip.label} />
        {detail.edited && <EditedMark />}
        {!fact.confirmed && <UnconfirmedBadge />}
      </div>

      {/* Never ask someone to verify words they typed themselves. */}
      {!fact.confirmed && !detail.edited && (
        <div className="mt-4 rounded-[16px] bg-[var(--hh-accent-wash)] p-4">
          <p className="text-[15px] leading-[1.45]">
            We read this off the letter but we are not certain. Does it look right?
          </p>
          <Button className="mt-3" onClick={confirmFact} disabled={busy}>
            Yes, that’s right
          </Button>
        </div>
      )}

      <div className="mt-4">
        {fact.fields.map((field) =>
          fixing === field.key ? (
            <FixThis
              key={field.key}
              field={field}
              busy={busy}
              onCancel={() => setFixing(null)}
              onSave={(value) => saveFix(field.key, value)}
            />
          ) : (
            <FieldRow
              key={field.key}
              label={field.label}
              value={
                <>
                  {readable(field) || '—'}
                  {field.edited && <EditedMark className="ml-2 align-middle" />}
                </>
              }
              note={
                field.edited && field.aiValue && field.aiValue !== field.value ? (
                  <p className="mt-1 text-[13px] leading-[1.4] text-[var(--hh-secondary)]">
                    was: {field.aiValue}
                  </p>
                ) : undefined
              }
              action={
                field.correctable ? (
                  <button
                    type="button"
                    onClick={() => setFixing(field.key)}
                    className="min-h-[44px] shrink-0 rounded-full px-3 text-[15px] font-medium text-[var(--hh-accent)]"
                  >
                    Fix this
                  </button>
                ) : undefined
              }
            />
          )
        )}
      </div>

      {table === 'open_loops' && <ChasePanel loopId={item.id} overdue={item.loopState === 'overdue'} />}

      {detail.document.transcriptExcerpt && (
        <div className="mt-4">
          <Meta>
            {detail.document.excerptLocated
              ? 'What the letter says here'
              : 'The start of this letter — we could not point to the exact line'}
          </Meta>
          <p className="mt-1 rounded-[10px] bg-[var(--hh-bg)] p-3 text-[15px] leading-[1.45] whitespace-pre-wrap">
            {detail.document.transcriptExcerpt}
          </p>
        </div>
      )}

      {error && <p className="mt-3 text-[13px] text-[var(--hh-red)]">{error}</p>}
    </>
  )
}

interface ChaseDraft {
  to: string
  subject: string
  body: string
}

/**
 * "Chase this?" (SPEC-FINAL §4/§10). The referral that went quiet is the thing
 * a family finds out about a year too late, and the reason it never gets
 * chased is that the letter is both trivial and impossible to write. So it is
 * already written, with the references in it, and they press send.
 */
function ChasePanel({ loopId, overdue }: { loopId: string; overdue: boolean }) {
  const [draft, setDraft] = useState<ChaseDraft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const write = () => {
    setBusy(true)
    setError('')
    apiJson<ChaseDraft>(`/api/loops/${loopId}/chase`)
      .then((body) => {
        if (live.current) setDraft(body)
      })
      .catch((e: unknown) => {
        if (live.current) setError(humanError(e))
      })
      .finally(() => {
        if (live.current) setBusy(false)
      })
  }

  if (!draft) {
    return (
      <div className="mt-5">
        <Button variant={overdue ? 'primary' : 'quiet'} onClick={write} disabled={busy}>
          {busy ? 'Writing it…' : 'Chase this?'}
        </Button>
        <Meta className="mt-2">
          We will write a short letter asking where this has got to, using the details from the
          letter it came from. Nothing is sent — it is yours to check and send.
        </Meta>
        {error && <p className="mt-2 text-[13px] text-[var(--hh-red)]">{error}</p>}
      </div>
    )
  }

  const full = `To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`

  return (
    <div className="mt-5">
      <Meta>Ready to send</Meta>
      <div className="mt-1 rounded-[10px] bg-[var(--hh-bg)] p-3">
        <FieldRow label="To" value={draft.to} />
        <FieldRow label="Subject" value={draft.subject} />
        <p className="mt-3 text-[15px] leading-[1.45] whitespace-pre-wrap">{draft.body}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          onClick={() => {
            navigator.clipboard.writeText(full).then(
              () => setCopied(true),
              () => setCopied(false)
            )
          }}
        >
          {copied ? 'Copied' : 'Copy the letter'}
        </Button>
        <a
          href={`mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`}
          className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--hh-hairline)] px-5 text-[15px] font-medium"
        >
          Open in email
        </a>
      </div>
      <Meta className="mt-2">Check it before you send it — it is written from one letter.</Meta>
    </div>
  )
}

/** The correction overlay (SPEC-FINAL §3) — one field at a time, warm words. */
function FixThis({
  field,
  busy,
  onSave,
  onCancel,
}: {
  field: FactField
  busy: boolean
  onSave: (value: string) => void
  onCancel: () => void
}) {
  // A date/datetime control only accepts its own wire format, so a stored
  // timestamp is trimmed to what the picker can show.
  const [value, setValue] = useState(
    field.input === 'datetime' ? field.value.replace(' ', 'T').slice(0, 16) : field.value
  )
  const id = `fix-${field.key}`
  const control =
    'mt-1 min-h-[44px] w-full rounded-[10px] border border-[var(--hh-hairline)] bg-[var(--hh-card)] px-3 text-[15px]'

  return (
    <form
      className="border-b border-[var(--hh-hairline)] py-3 last:border-b-0"
      onSubmit={(e) => {
        e.preventDefault()
        onSave(value.trim())
      }}
    >
      <label htmlFor={id} className="text-[13px] leading-[1.4] text-[var(--hh-secondary)]">
        {field.label}
      </label>
      {/* The control matches what the field holds, so a fix cannot be typed in
          a shape the story would then quietly ignore. */}
      {field.input === 'choice' ? (
        <select
          id={id}
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={control}
        >
          <option value="">Choose one</option>
          {(field.choices ?? []).map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          autoFocus
          type={field.input === 'date' ? 'date' : field.input === 'datetime' ? 'datetime-local' : 'text'}
          inputMode={field.input === 'number' ? 'decimal' : undefined}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={control}
        />
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !value.trim()}>
          {busy ? 'Saving…' : 'Save the fix'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

interface Translation {
  whatItSays: string
  whatChanged: string
  whatHappensNext: string
}

function LetterPanel({ item }: { item: TimelineItem }) {
  const documentId = item.sourceChip.documentId
  const [doc, setDoc] = useState<DocumentBody['document'] | null>(null)
  const [plain, setPlain] = useState<Translation | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  useEffect(() => {
    apiJson<DocumentBody>(`/api/documents/${documentId}`)
      .then((body) => {
        if (live.current) setDoc(body.document)
      })
      .catch(() => {})
  }, [documentId])

  // Asked for, not assumed: most letters are never opened, and reading one
  // back in plain English costs a real call.
  const explain = () => {
    setBusy(true)
    setError('')
    apiJson<Translation>(`/api/documents/${documentId}/translate`)
      .then((body) => {
        if (live.current) setPlain(body)
      })
      .catch((e: unknown) => {
        if (live.current) setError(humanError(e))
      })
      .finally(() => {
        if (live.current) setBusy(false)
      })
  }

  const written = doc?.docDate ?? (item.date || null)

  return (
    <>
      <h2 className="text-[17px] font-semibold leading-[1.3]">{item.humanTitle}</h2>
      <div className="mt-3">
        {doc?.sender && <FieldRow label="Who sent it" value={doc.sender} />}
        {written && <FieldRow label="When it was written" value={longDate(written)} />}
      </div>
      <div className="mt-3">
        <SourceChip label={item.sourceChip.label} />
      </div>

      <div className="mt-5">
        {plain ? (
          <div className="flex flex-col gap-4">
            <Passage title="What this letter says" body={plain.whatItSays} />
            <Passage title="What changed" body={plain.whatChanged} />
            <Passage title="What happens next" body={plain.whatHappensNext} />
          </div>
        ) : (
          <Button variant="quiet" onClick={explain} disabled={busy}>
            {busy ? 'Reading it…' : 'What this letter says'}
          </Button>
        )}
        {error && <p className="mt-3 text-[13px] text-[var(--hh-red)]">{error}</p>}
      </div>
    </>
  )
}

function Passage({ title, body }: { title: string; body: string }) {
  if (!body) return null
  return (
    <div>
      <Meta>{title}</Meta>
      <p className="mt-1 text-[15px] leading-[1.45] whitespace-pre-wrap">{body}</p>
    </div>
  )
}

/**
 * "12 May 2026", not "2026-05-12". The wire format is what the date picker
 * needs and what the API stores; nobody should have to read it.
 */
function readable(field: FactField): string {
  if (!field.value) return ''
  if (field.input === 'date') return longDate(field.value)
  if (field.input === 'datetime') {
    const [date, time] = field.value.replace(' ', 'T').split('T')
    const day = longDate(date)
    return time ? `${day}, ${time.slice(0, 5)}` : day
  }
  return field.value
}

function longDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

type Envelope = { error?: { code?: string; message?: string } }

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const body = (await res.json().catch(() => null)) as (T & Envelope) | null
  if (!res.ok || !body) {
    throw new Error(body?.error?.message ?? 'That did not work. Try again in a moment.')
  }
  return body
}

const humanError = (e: unknown) =>
  e instanceof Error ? e.message : 'That did not work. Try again in a moment.'
