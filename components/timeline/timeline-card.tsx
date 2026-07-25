'use client'

import {
  Activity,
  ChevronRight,
  Clock3,
  FileText,
  Pill,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type { TimelineItem, TimelineItemType } from '@/lib/types'
import { CardHeader, EditedMark, Meta, SourceChip, StatusPill, TypeIcon } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

/**
 * The six card variants (SPEC-FINAL §4), in the design lane's shape: an icon
 * chip, the human-meaning header, the date, one payload line, and the source
 * chip at the bottom. One idea per card.
 */
const ICONS: Record<TimelineItemType, typeof FileText> = {
  letter: FileText,
  result: Activity,
  med_change: Pill,
  open_loop: Clock3,
  needs_look: TriangleAlert,
  processing: Sparkles,
}

export function TimelineCard({
  item,
  onOpen,
}: {
  item: TimelineItem
  onOpen?: (item: TimelineItem) => void
}) {
  const Icon = ICONS[item.itemType]
  const overdue = item.itemType === 'open_loop' && item.loopState === 'overdue'
  const attention = overdue || item.itemType === 'needs_look'

  if (item.itemType === 'processing') {
    return (
      <li className="rounded-lg border border-dashed border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <TypeIcon>
            <Icon className="size-4 animate-pulse" />
          </TypeIcon>
          <div className="min-w-0 flex-1">
            <CardHeader>{item.humanTitle}</CardHeader>
            <Meta className="mt-0.5">{shortDate(item.date)}</Meta>
          </div>
        </div>
        {/* The skeleton is the point of this card: something is happening to
            your letter right now, and you can watch it happen. */}
        <div className="mt-4 flex flex-col gap-2" aria-hidden>
          <span className="h-3 w-4/5 animate-pulse rounded-full bg-muted" />
          <span className="h-3 w-3/5 animate-pulse rounded-full bg-muted" />
        </div>
        <p aria-live="polite" className="mt-4 text-[15px] text-foreground/80">
          {item.payloadLine}
        </p>
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className={cn(
          'w-full cursor-pointer rounded-lg border p-4 text-left active:opacity-90',
          attention ? 'border-warn/25 bg-warn-wash' : 'border-border bg-card'
        )}
      >
        <div className="flex items-center gap-3">
          <TypeIcon tone={attention ? 'warn' : 'accent'}>
            <Icon className="size-4" />
          </TypeIcon>
          <div className="min-w-0 flex-1">
            <CardHeader>{item.humanTitle}</CardHeader>
            <Meta className="mt-0.5">{shortDate(item.date)}</Meta>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </div>

        {item.payloadLine && (
          <p className="mt-3 text-[15px] leading-[1.45] font-medium text-pretty break-words">
            {item.payloadLine}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <SourceChip label={item.sourceChip.label} />
          {overdue && <StatusPill tone="warn">Overdue</StatusPill>}
          {item.edited && <EditedMark />}
          {!item.confirmed && <StatusPill tone="warn">Unconfirmed</StatusPill>}
        </div>
      </button>
    </li>
  )
}

function shortDate(iso: string): string {
  const at = new Date(`${iso}T00:00:00Z`)
  if (Number.isNaN(at.getTime())) return ''
  return at.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
