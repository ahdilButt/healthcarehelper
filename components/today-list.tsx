'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight, Clock3 } from 'lucide-react'
import { CupIllustration } from '@/components/illustrations'
import { usePerson } from '@/components/person-context'
import { Card, Meta, PageTitle, StatusPill } from '@/components/ui-bits'
import { meds as initialMeds, overdueFollowUps, todayDate, type Med, type MedSlot } from '@/lib/mock'
import { cn } from '@/lib/utils'

const slots: MedSlot[] = ['Morning', 'Afternoon', 'Evening']

export function TodayList() {
  const { person } = usePerson()
  const [meds, setMeds] = useState<Med[]>(initialMeds)

  function toggle(id: string) {
    setMeds((list) =>
      list.map((m) => (m.id === id ? { ...m, taken: !m.taken, missed: m.taken ? m.missed : false } : m)),
    )
  }

  if (person.id !== 'dad') {
    return (
      <div className="px-5">
        <PageTitle className="pt-1">Today</PageTitle>
        <Meta className="mt-1">{todayDate}</Meta>
        <div className="mt-10 flex flex-col items-center text-center">
          <CupIllustration className="w-40 text-primary" />
          <p className="mt-6 text-[17px] font-semibold">Nothing to take today</p>
          <Meta className="mt-2 max-w-[28ch]">
            When you add your own medicines, they&apos;ll show up here morning to evening.
          </Meta>
        </div>
      </div>
    )
  }

  const left = meds.filter((m) => !m.taken).length

  return (
    <div className="px-5">
      <OverdueFollowUp personId={person.id} />
      <PageTitle className="pt-1 pr-36">Today</PageTitle>
      <div className="mt-1 flex flex-wrap items-center gap-3 pr-36">
        <Meta>{todayDate}</Meta>
        {left > 0 ? (
          <StatusPill tone="warn">{left} still to take</StatusPill>
        ) : (
          <StatusPill tone="good">All done for today</StatusPill>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-6">
        {slots.map((slot) => {
          const rows = meds.filter((m) => m.slot === slot)
          return (
            <section key={slot}>
              <h2 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {slot}
              </h2>
              <div className="mt-2 flex flex-col gap-3">
                {rows.length === 0 ? (
                  <Card className="py-3">
                    <Meta>Nothing this {slot.toLowerCase()}</Meta>
                  </Card>
                ) : null}
                {rows.map((med) => (
                  <MedRow key={med.id} med={med} onToggle={() => toggle(med.id)} />
                ))}
              </div>
            </section>
          )
        })}
      </div>

      <Card className="mt-6">
        <p className="text-[15px] font-medium">Six-week blood test</p>
        <Meta className="mt-1">
          The heart clinic asked for a kidney check around 23 June — worth booking now.
        </Meta>
      </Card>
    </div>
  )
}

/**
 * Overdue follow-ups from the open_loops table. There is deliberately no way to
 * dismiss this card: it only disappears when the loop's state becomes 'done',
 * which happens when a new document proves the follow-up actually happened.
 */
function OverdueFollowUp({ personId }: { personId: string }) {
  const loops = overdueFollowUps(personId)
  if (loops.length === 0) return null
  const loop = loops[0]

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[3.5rem] z-30 mx-auto w-full max-w-[720px]">
      <div className="flex justify-end px-5">
        <aside
          aria-label="Still waiting to happen"
          className="pointer-events-auto flex size-32 flex-col justify-between rounded-lg bg-accent p-3 text-accent-foreground shadow-[0_4px_14px_rgba(32,26,23,0.08)]"
        >
          <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
            <Clock3 className="size-3.5" aria-hidden="true" />
            Still waiting
          </span>
          <p className="text-[13px] font-medium leading-snug text-pretty">{loop.description}</p>
          <span className="text-[13px] text-muted-foreground">
            {loop.days_overdue} days overdue
          </span>
        </aside>
      </div>
    </div>
  )
}

function MedRow({ med, onToggle }: { med: Med; onToggle: () => void }) {
  const missed = med.missed && !med.taken

  return (
    <Card tone={missed ? 'warn' : 'plain'} className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={med.taken}
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
          med.taken
            ? 'border-good bg-good text-primary-foreground'
            : missed
              ? 'border-warn/50 text-transparent'
              : 'border-border text-transparent active:bg-muted',
        )}
      >
        <Check className="size-5" strokeWidth={2.6} />
        <span className="sr-only">{med.taken ? `${med.name} taken` : `Mark ${med.name} as taken`}</span>
      </button>

      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-semibold leading-snug">{med.name}</p>
        <Meta className="mt-0.5">{med.dose}</Meta>
        {missed ? <Meta className="mt-1 text-warn">Missed this morning — still worth taking</Meta> : null}
        {med.note && !missed ? <Meta className="mt-1">{med.note}</Meta> : null}

        {med.isPatch ? (
          <Link
            href="/body-map"
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-[13px] font-medium text-primary"
          >
            {med.patchSiteToday}
            <ChevronRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </Card>
  )
}
