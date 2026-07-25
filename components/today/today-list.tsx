'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DueItem } from '@/lib/types'
import { Card, CardHeader, Meta, PageTitle } from '@/components/ui/primitives'
import { BodyMap } from '@/components/ui/illustrations'

export interface TodayGroups {
  morning: DueItem[]
  afternoon: DueItem[]
  evening: DueItem[]
}

const PARTS: { key: keyof TodayGroups; label: string }[] = [
  { key: 'morning', label: 'Morning' },
  { key: 'afternoon', label: 'Afternoon' },
  { key: 'evening', label: 'Evening' },
]

/**
 * Today (SPEC-FINAL §6). Three parts of a day, one tap per row.
 *
 * Nothing here is ever red. A missed dose is amber and says "still to take" —
 * the person reading this screen is usually the person who missed it, and the
 * app's job is to help, not to mark their homework.
 */
export function TodayList({
  personId,
  personName,
  initialGroups,
}: {
  personId: string
  personName: string
  initialGroups: TodayGroups
}) {
  const [groups, setGroups] = useState(initialGroups)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  // Null until the browser has it: the server cannot know the reader's clock,
  // and guessing would make the first paint disagree with the second. Ticking
  // it every minute is what makes "due now" true while the screen is open.
  const [now, setNow] = useState<number | null>(null)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  useEffect(() => {
    const beat = () => setNow(Date.now())
    beat()
    const timer = setInterval(beat, 60_000)
    return () => clearInterval(timer)
  }, [])

  const refresh = useCallback(
    () =>
      fetch(`/api/today/${personId}`)
        .then((res) => (res.ok ? (res.json() as Promise<{ groups: TodayGroups }>) : null))
        .then((body) => {
          if (live.current && body) setGroups(body.groups)
        })
        .catch(() => {}),
    [personId]
  )

  const toggle = useCallback(
    (item: DueItem) => {
      const key = `${item.routineId}@${item.dueAt}`
      setBusy(key)
      setError('')
      fetch('/api/taken', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ routineId: item.routineId, dueAt: item.dueAt, taken: !item.taken }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
            throw new Error(body?.error?.message ?? 'That did not save.')
          }
          return refresh()
        })
        .catch((e: unknown) => {
          if (live.current) setError(e instanceof Error ? e.message : 'That did not save.')
        })
        .finally(() => {
          if (live.current) setBusy(null)
        })
    },
    [refresh]
  )

  const all = [...groups.morning, ...groups.afternoon, ...groups.evening]
  const patch = all.find((i) => i.form === 'patch')

  return (
    <div className="pb-4">
      <div className="py-4">
        <PageTitle>Today</PageTitle>
        <Meta className="mt-1">{summary(all, personName)}</Meta>
      </div>

      {all.length === 0 ? (
        <Card>
          <CardHeader>Nothing to take today</CardHeader>
          <Meta className="mt-1">
            When a letter names a medicine, its times appear here on their own.
          </Meta>
        </Card>
      ) : (
        PARTS.map(({ key, label }) =>
          groups[key].length ? (
            <section key={key} className="mb-5">
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-[var(--hh-secondary)]">
                {label}
              </h2>
              <ul className="flex flex-col gap-2">
                {groups[key].map((item) => (
                  <MedRow
                    key={`${item.routineId}@${item.dueAt}`}
                    item={item}
                    now={now}
                    busy={busy === `${item.routineId}@${item.dueAt}`}
                    onToggle={() => toggle(item)}
                  />
                ))}
              </ul>
            </section>
          ) : null
        )
      )}

      {patch?.site && (
        <section className="mt-2">
          <Card>
            <CardHeader>Where the patch goes</CardHeader>
            <Meta className="mt-1">
              {patch.site.last
                ? `Last one went on the ${patch.site.last}. Next: the ${patch.site.next}.`
                : `Start with the ${patch.site.next}.`}
            </Meta>
            <div className="mt-3 flex justify-center">
              <BodyMap last={patch.site.last} next={patch.site.next} size={150} />
            </div>
          </Card>
        </section>
      )}

      {error && <p className="mt-3 text-[15px] text-[var(--hh-red)]">{error}</p>}
    </div>
  )
}

function MedRow({
  item,
  now,
  busy,
  onToggle,
}: {
  item: DueItem
  now: number | null
  busy: boolean
  onToggle: () => void
}) {
  const due = now !== null && new Date(item.dueAt).getTime() <= now
  const missed = due && !item.taken

  return (
    <li>
      <Card className={`p-0 ${missed ? 'border-[var(--hh-amber)]/40' : ''}`}>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-pressed={item.taken}
          className="flex w-full items-center gap-3 p-4 text-left disabled:opacity-60"
        >
          <Tick taken={item.taken} />
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold leading-[1.3]">{item.humanName}</span>
            <span className="mt-[2px] block text-[15px] leading-[1.45]">
              {item.dose}
              {item.form === 'patch' && item.site?.next ? ` · on the ${item.site.next}` : ''}
            </span>
            <span className="mt-1 block text-[13px] leading-[1.4] text-[var(--hh-secondary)]">
              {item.taken ? 'Taken' : missed ? 'Still to take' : `Due at ${clock(item.dueAt)}`}
            </span>
          </span>
        </button>
      </Card>
    </li>
  )
}

function Tick({ taken }: { taken: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
        taken
          ? 'border-[var(--hh-green)] bg-[var(--hh-green)]'
          : 'border-[var(--hh-hairline)] bg-transparent'
      }`}
    >
      {taken && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m5 13 4.5 4.5L19 7" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  )
}

function summary(items: DueItem[], personName: string): string {
  if (!items.length) return `Nothing scheduled for ${personName} today.`
  const left = items.filter((i) => !i.taken).length
  if (!left) return `All done — every one of ${personName}’s medicines is ticked off.`
  return `${left} of ${items.length} still to take.`
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}
