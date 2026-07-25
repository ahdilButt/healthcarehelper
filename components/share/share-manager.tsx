'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CapsuleKind } from '@/lib/types'
import type { CapsulePayload } from '@/lib/capsules/build'
import { Button, Card, CardHeader, Meta, PageTitle } from '@/components/ui/primitives'

export interface CapsuleSummary {
  id: string
  kind: CapsuleKind
  url: string
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
  views: { viewedAt: string }[]
}

const KINDS: { kind: CapsuleKind; title: string; blurb: string; expiry: string }[] = [
  {
    kind: 'doctor_brief',
    title: 'Share with a doctor',
    blurb: 'The 30-second brief: allergies, medicines, problems, recent results, what is in the air.',
    expiry: 'Expires after 24 hours',
  },
  {
    kind: 'paramedic',
    title: 'Emergency card',
    blurb: 'For a lock screen or a wallet: allergies, medicines, problems, who to call.',
    expiry: 'Lasts until you take it back',
  },
  {
    kind: 'family',
    title: 'Share with family',
    blurb: 'Medicines and upcoming appointments. Nothing else.',
    expiry: 'Expires after 30 days',
  },
]

/**
 * Share (SPEC-FINAL §7). Pick a kind, see EXACTLY what a stranger will see,
 * then make the link.
 *
 * The preview is the trust-building step and is not optional: handing over a
 * link to your father's medical record without first reading it yourself is
 * the thing people are right to be afraid of.
 */
export function ShareManager({
  personId,
  personName,
  previews,
  initialCapsules,
  initialDnr,
  isOwner,
}: {
  personId: string
  personName: string
  previews: Record<CapsuleKind, CapsulePayload>
  initialCapsules: CapsuleSummary[]
  initialDnr: boolean | null
  isOwner: boolean
}) {
  const [kind, setKind] = useState<CapsuleKind>('doctor_brief')
  const [capsules, setCapsules] = useState(initialCapsules)
  const [made, setMade] = useState<{ url: string; qr: string; kind: CapsuleKind } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const refresh = useCallback(
    () =>
      fetch(`/api/capsules/${personId}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ capsules: CapsuleSummary[] }>) : null))
        .then((body) => {
          if (live.current && body) setCapsules(body.capsules)
        })
        .catch(() => {}),
    [personId]
  )

  const act = useCallback(
    (url: string, body?: unknown) => {
      setBusy(true)
      setError('')
      return fetch(url, {
        method: 'POST',
        ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
      })
        .then(async (res) => {
          const parsed = (await res.json().catch(() => null)) as Record<string, unknown> & {
            error?: { message?: string }
          }
          if (!res.ok) throw new Error(parsed?.error?.message ?? 'That did not work.')
          return parsed
        })
        .catch((e: unknown) => {
          if (live.current) setError(e instanceof Error ? e.message : 'That did not work.')
          return null
        })
        .finally(() => {
          if (live.current) setBusy(false)
        })
    },
    []
  )

  const create = () => {
    void act('/api/capsules', { personId, kind }).then((body) => {
      if (!body || !live.current) return
      const capsule = body.capsule as { url: string }
      setMade({ url: capsule.url, qr: String(body.qrPngDataUrl ?? ''), kind })
      void refresh()
    })
  }

  const preview = previews[kind]
  const chosen = KINDS.find((k) => k.kind === kind)

  return (
    <div className="pb-4">
      <div className="py-4">
        <PageTitle>Share</PageTitle>
        <Meta className="mt-1">
          A link that shows part of {personName}&rsquo;s record. No account needed at the other end.
        </Meta>
      </div>

      <div className="flex flex-col gap-2">
        {KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => {
              setKind(k.kind)
              setMade(null)
            }}
            aria-pressed={kind === k.kind}
            className={`rounded-[16px] border p-4 text-left ${
              kind === k.kind
                ? 'border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]'
                : 'border-[var(--hh-hairline)] bg-[var(--hh-card)]'
            }`}
          >
            <span className="block text-[17px] font-semibold leading-[1.3]">{k.title}</span>
            <span className="mt-1 block text-[15px] leading-[1.45]">{k.blurb}</span>
            <span className="mt-1 block text-[13px] text-[var(--hh-secondary)]">{k.expiry}</span>
          </button>
        ))}
      </div>

      {kind === 'paramedic' && isOwner && (
        <DnrControl personId={personId} personName={personName} initial={initialDnr} />
      )}

      <section className="mt-5">
        <CardHeader>What they will see</CardHeader>
        <Meta className="mt-1">
          Exactly this, and nothing else. Anything still waiting to be checked is left out.
        </Meta>
        <Card className="mt-2">
          <p className="text-[15px] font-semibold">{preview.personName}</p>
          {preview.sections.map((section) => (
            <div key={section.heading} className="mt-3">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--hh-secondary)]">
                {section.heading}
              </p>
              {section.lines.length === 0 ? (
                <p className="text-[15px] text-[var(--hh-secondary)]">{section.emptyText}</p>
              ) : (
                <ul>
                  {section.lines.map((line, i) => (
                    <li key={`${line.text}-${i}`} className="text-[15px] leading-[1.45]">
                      {line.text}
                      {line.note && (
                        <span className="block text-[13px] text-[var(--hh-secondary)]">{line.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Card>

        {!made && (
          <Button className="mt-3" onClick={create} disabled={busy}>
            {busy ? 'Making the link…' : `Make the ${chosen?.title.toLowerCase()} link`}
          </Button>
        )}
      </section>

      {made && <MadeLink made={made} />}
      {error && <p className="mt-3 text-[15px] text-[var(--hh-red)]">{error}</p>}

      {capsules.length > 0 && (
        <section className="mt-6">
          <CardHeader>Links you have shared</CardHeader>
          <ul className="mt-2 flex flex-col gap-2">
            {capsules.map((c) => (
              <li key={c.id}>
                <ManageCard
                  capsule={c}
                  busy={busy}
                  onRevoke={() => void act(`/api/capsules/${c.id}/revoke`).then(refresh)}
                  onRenew={() => void act(`/api/capsules/${c.id}/renew`).then(refresh)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * The one line on an emergency card that no letter can supply (SPEC-FINAL §7).
 * Deliberately three explicit states — leaving it unset says "we do not know",
 * which is not the same as "there is none", and a paramedic needs the
 * difference.
 */
function DnrControl({
  personId,
  personName,
  initial,
}: {
  personId: string
  personName: string
  initial: boolean | null
}) {
  const [value, setValue] = useState<boolean | null>(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const choices: { label: string; next: boolean | null }[] = [
    { label: 'Not recorded', next: null },
    { label: 'There is one', next: true },
    { label: 'There is none', next: false },
  ]

  const set = (next: boolean | null) => {
    setBusy(true)
    setError('')
    fetch(`/api/persons/${personId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dnrStatus: next }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
          throw new Error(body?.error?.message ?? 'That did not save.')
        }
        setValue(next)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'That did not save.'))
      .finally(() => setBusy(false))
  }

  return (
    <Card className="mt-4">
      <CardHeader>Is there a DNACPR decision for {personName}?</CardHeader>
      <Meta className="mt-1">
        A do-not-attempt-CPR decision is made with a clinician and written down. This only records
        what you have been told — it does not create one.
      </Meta>
      <div className="mt-3 flex flex-wrap gap-2">
        {choices.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={busy}
            onClick={() => set(c.next)}
            aria-pressed={value === c.next}
            className={`min-h-[44px] rounded-full border px-4 text-[15px] ${
              value === c.next
                ? 'border-[var(--hh-accent)] bg-[var(--hh-accent-wash)]'
                : 'border-[var(--hh-hairline)] bg-[var(--hh-card)]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <Meta className="mt-2">
        The card is refreshed when you make the link, so set this first.
      </Meta>
      {error && <p className="mt-2 text-[13px] text-[var(--hh-red)]">{error}</p>}
    </Card>
  )
}

function MadeLink({ made }: { made: { url: string; qr: string; kind: CapsuleKind } }) {
  const [copied, setCopied] = useState(false)
  return (
    <Card className="mt-4">
      <CardHeader>Ready to show</CardHeader>
      <Meta className="mt-1">Hold this up to their camera, or send the link.</Meta>
      {made.qr && (
        // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not an asset
        <img
          src={made.qr}
          alt="QR code for the shared link"
          className="mx-auto mt-3 h-[220px] w-[220px]"
        />
      )}
      <p className="mt-3 break-all text-[13px] text-[var(--hh-secondary)]">{made.url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            navigator.clipboard.writeText(made.url).then(
              () => setCopied(true),
              () => setCopied(false)
            )
          }}
        >
          {copied ? 'Copied' : 'Copy the link'}
        </Button>
        {made.kind === 'paramedic' && (
          <a
            href={made.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--hh-hairline)] px-5 text-[15px] font-medium"
          >
            Open it
          </a>
        )}
      </div>
    </Card>
  )
}

function ManageCard({
  capsule,
  busy,
  onRevoke,
  onRenew,
}: {
  capsule: CapsuleSummary
  busy: boolean
  onRevoke: () => void
  onRenew: () => void
}) {
  const dead = Boolean(capsule.revokedAt)
  const title = KINDS.find((k) => k.kind === capsule.kind)?.title ?? 'Shared link'
  const lastView = capsule.views[0]

  return (
    <Card className={dead ? 'opacity-60' : ''}>
      <CardHeader>{title}</CardHeader>
      <Meta className="mt-1">
        {dead
          ? 'Taken back — it no longer opens.'
          : capsule.expiresAt
            ? `Expires ${when(capsule.expiresAt)}`
            : 'Lasts until you take it back'}
      </Meta>
      <Meta className="mt-1">
        {capsule.views.length === 0
          ? 'Not opened yet'
          : `Opened ${capsule.views.length} time${capsule.views.length > 1 ? 's' : ''} · last ${when(lastView.viewedAt)}`}
      </Meta>
      {!dead && (
        <div className="mt-3 flex flex-wrap gap-2">
          {capsule.kind === 'paramedic' && (
            <a
              href={`/api/capsules/${capsule.id}/wallet.pdf`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--hh-hairline)] px-5 text-[15px] font-medium"
            >
              Wallet card
            </a>
          )}
          {capsule.expiresAt && (
            <Button variant="ghost" onClick={onRenew} disabled={busy}>
              Give it longer
            </Button>
          )}
          <Button variant="ghost" onClick={onRevoke} disabled={busy}>
            Take it back
          </Button>
        </div>
      )}
    </Card>
  )
}

function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
