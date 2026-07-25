'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, ChevronRight } from 'lucide-react'
import { CupIllustration } from '@/components/illustrations'
import { usePerson } from '@/components/person-context'
import { Card, Meta, PageTitle, StatusPill } from '@/components/ui-bits'
import { meds as initialMeds, todayDate, type Med, type MedSlot } from '@/lib/mock'
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
      <PageTitle className="pt-1">Today</PageTitle>
      <div className="mt-1 flex flex-wrap items-center gap-3">
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
