'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  Activity,
  ChevronRight,
  Clock3,
  FileText,
  Pill,
  Sparkles,
  TrendingDown,
  TriangleAlert,
} from 'lucide-react'
import { DetailSheet } from '@/components/detail-sheet'
import { ShoeboxIllustration } from '@/components/illustrations'
import { usePerson } from '@/components/person-context'
import { Card, CardHeader, Meta, PageTitle, SourceChip, StatusPill, TypeIcon } from '@/components/ui-bits'
import { type TimelineItem } from '@/lib/mock'

const icons = {
  letter: FileText,
  result: Activity,
  'med-change': Pill,
  watch: Clock3,
  'needs-a-look': TriangleAlert,
  processing: Sparkles,
}

export function TimelineFeed() {
  const { person, items } = usePerson()
  const [selected, setSelected] = useState<TimelineItem | null>(null)

  const months: { month: string; items: TimelineItem[] }[] = []
  for (const item of items) {
    const last = months[months.length - 1]
    if (last && last.month === item.month) last.items.push(item)
    else months.push({ month: item.month, items: [item] })
  }

  return (
    <div className="px-5">
      <PageTitle className="pt-1">{person.id === 'dad' ? "Dad's story" : 'Your story'}</PageTitle>
      <Meta className="mt-1">Everything we&apos;ve read, newest first</Meta>

      {items.length === 0 ? <EmptyState who={person.id === 'dad' ? "Dad's story" : 'your story'} /> : null}

      {months.map((group) => (
        <section key={group.month} className="mt-2">
          <h2 className="sticky top-[60px] z-20 -mx-5 bg-background/92 px-5 py-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur">
            {group.month}
          </h2>
          <div className="flex flex-col gap-3 pt-1">
            {group.items.map((item) => (
              <TimelineCard key={item.id} item={item} onOpen={() => setSelected(item)} />
            ))}
          </div>
        </section>
      ))}

      <DetailSheet item={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function TimelineCard({ item, onOpen }: { item: TimelineItem; onOpen: () => void }) {
  const Icon = icons[item.kind]

  if (item.kind === 'processing') {
    return (
      <Card className="border-dashed">
        <div className="flex items-center gap-3">
          <TypeIcon>
            <Icon className="size-4 animate-pulse" />
          </TypeIcon>
          <div className="min-w-0 flex-1">
            <CardHeader>{item.header}</CardHeader>
            <Meta className="mt-0.5">{item.date}</Meta>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
          <span className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
          <span className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
        </div>
        <p aria-live="polite" className="mt-4 text-[15px] text-foreground/80">
          {item.payload}{' '}
          <span className="text-muted-foreground">{item.progressLine}</span>
        </p>
      </Card>
    )
  }

  const isNeedsLook = item.kind === 'needs-a-look'

  return (
    <Card
      as="button"
      tone={isNeedsLook ? 'warn' : 'plain'}
      onClick={onOpen}
      className="w-full cursor-pointer text-left active:opacity-90"
    >
      <div className="flex items-center gap-3">
        <TypeIcon tone={isNeedsLook ? 'warn' : 'accent'}>
          <Icon className="size-4" />
        </TypeIcon>
        <div className="min-w-0 flex-1">
          <CardHeader>{item.header}</CardHeader>
          <Meta className="mt-0.5">{item.date}</Meta>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="mt-3 flex items-start gap-3">
        {item.thumbnail && isNeedsLook ? (
          <Image
            src={item.thumbnail}
            alt=""
            width={112}
            height={112}
            className="size-14 shrink-0 rounded-md border border-warn/25 object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[15px] font-medium text-pretty">
            {item.payload}
            {item.direction === 'down' ? (
              <TrendingDown className="size-4 shrink-0 text-warn" aria-label="lower than before" />
            ) : null}
          </p>
          {item.sub ? <Meta className="mt-1">{item.sub}</Meta> : null}
        </div>
      </div>

      {item.statusPill ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StatusPill tone={item.statusPill.tone}>{item.statusPill.text}</StatusPill>
          <span className="text-[13px] font-medium text-primary underline underline-offset-2">
            Chase this?
          </span>
        </div>
      ) : null}

      {item.source ? (
        <div className="mt-4 border-t border-border/70 pt-3">
          <SourceChip label={item.source} />
        </div>
      ) : null}
    </Card>
  )
}

function EmptyState({ who }: { who: string }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <ShoeboxIllustration className="w-44 text-primary" />
      <p className="mt-6 max-w-[26ch] text-[17px] font-semibold text-pretty">
        Add the first letter — photograph it and watch {who} build.
      </p>
      <Meta className="mt-2 max-w-[30ch]">
        Use the apricot button below. Letters, results slips and pharmacy labels all work.
      </Meta>
    </div>
  )
}
