'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { DueItem } from '@/lib/types'
import { Check } from 'lucide-react'
import { Card, CardHeader, Meta, PageTitle, StatusPill } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'
import { BodyMap } from '@/components/ui/illustrations'
import { TodayBrief } from './today-brief'

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
  initialGroups,
}: {
  personId: string
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
      // Fill the circle now, not when the server answers. A tap that does
      // nothing for half a second reads as a tap that did not register, and
      // the next thing a person does is tap it again.
      setGroups((prev) => setTaken(prev, key, !item.taken))

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
          if (!live.current) return
          // Put it back: the record and the screen must not disagree.
          setGroups((prev) => setTaken(prev, key, item.taken))
          setError(e instanceof Error ? e.message : 'That did not save.')
        })
        .finally(() => {
          if (live.current) setBusy(null)
        })
    },
    [refresh]
  )

  const all = [...groups.morning, ...groups.afternoon, ...groups.evening]
  const left = all.filter((i) => !i.taken).length
  const patch = all.find((i) => i.form === 'patch')

  return (
    <div className="pb-4">
      <div className="py-4">
        <PageTitle>Today</PageTitle>
        {all.length > 0 && (
          <div className="mt-1">
            {left > 0 ? (
              <StatusPill tone="warn">{left} still to take</StatusPill>
            ) : (
              <StatusPill tone="good">All done for today</StatusPill>
            )}
          </div>
        )}
      </div>

      <TodayBrief personId={personId} dateLabel={longToday()} />

      <div className="mt-6" />

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
            <section key={key} className="mb-6">
              <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {label}
              </h2>
              <ul className="flex flex-col gap-3">
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

      {error && <p className="mt-3 text-[15px] text-alert">{error}</p>}
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
      <Card tone={missed ? 'warn' : 'plain'} className="flex items-center gap-3 py-3">
        {/* The tap target is the tick, not the whole row: a patch row carries a
            link to the body map, and a row-wide button would swallow it. */}
        <button
          type="button"
          onClick={onToggle}
          disabled={busy}
          aria-pressed={item.taken}
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-all active:scale-95 disabled:opacity-60',
            item.taken
              ? 'border-good bg-good text-white shadow-sm'
              : missed
                ? 'border-warn/60 bg-card text-transparent active:bg-warn/10'
                : 'border-border bg-card text-transparent active:bg-muted'
          )}
        >
          <Check className="size-6" strokeWidth={3} />
          <span className="sr-only">
            {item.taken ? `${item.humanName} taken` : `Mark ${item.humanName} as taken`}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-semibold leading-snug">{item.humanName}</p>
          <Meta className="mt-0.5">{item.dose}</Meta>
          <Meta className={cn('mt-1', missed && 'text-warn')}>
            {item.taken
              ? 'Taken'
              : missed
                ? 'Missed — still worth taking'
                : `Due at ${clock(item.dueAt)}`}
          </Meta>

          {item.form === 'patch' && item.site?.next && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-primary">
              On the {item.site.next}
            </span>
          )}
        </div>
      </Card>
    </li>
  )
}

/** One row's taken flag, without disturbing the rest of the day. */
function setTaken(groups: TodayGroups, key: string, taken: boolean): TodayGroups {
  const mark = (rows: DueItem[]) =>
    rows.map((r) => (`${r.routineId}@${r.dueAt}` === key ? { ...r, taken } : r))
  return {
    morning: mark(groups.morning),
    afternoon: mark(groups.afternoon),
    evening: mark(groups.evening),
  }
}

/** "Saturday, 25 July" — the date, the way a person says it. */
function longToday(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Europe/London',
  })
}

function clock(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Europe/London',
  })
}
