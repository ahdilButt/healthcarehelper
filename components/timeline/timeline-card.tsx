'use client'

import type { TimelineItem } from '@/lib/types'
import { Card, CardHeader, EditedMark, SourceChip, UnconfirmedBadge } from '@/components/ui/primitives'

/**
 * The six card variants (SPEC-FINAL §4): letter · result · med-change ·
 * open-loop · needs-a-look · processing. One idea per card, human-meaning
 * header, one payload line, source chip at the bottom.
 */
export function TimelineCard({
  item,
  onOpen,
}: {
  item: TimelineItem
  onOpen?: (item: TimelineItem) => void
}) {
  const isOverdue = item.itemType === 'open_loop' && item.loopState === 'overdue'
  const accent =
    item.itemType === 'processing'
      ? 'border-[var(--hh-accent)]/40'
      : isOverdue
        ? 'border-[var(--hh-amber)]/40'
        : item.itemType === 'needs_look'
          ? 'border-[var(--hh-amber)]/40'
          : ''

  return (
    <Card as="li" className={`mb-3 ${accent}`}>
      <button
        type="button"
        onClick={() => onOpen?.(item)}
        className="block w-full text-left"
        disabled={item.itemType === 'processing'}
      >
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-[2px] shrink-0">
            <VariantIcon type={item.itemType} overdue={isOverdue} />
          </span>
          <span className="min-w-0 flex-1">
            <CardHeader>{item.humanTitle}</CardHeader>
            {item.payloadLine && (
              <p className="mt-1 text-[15px] leading-[1.45] break-words">{item.payloadLine}</p>
            )}
            <span className="mt-2 flex flex-wrap items-center gap-2">
              {item.itemType !== 'processing' && <SourceChip label={item.sourceChip.label} />}
              {item.edited && <EditedMark />}
              {!item.confirmed && <UnconfirmedBadge />}
            </span>
          </span>
        </div>
      </button>
    </Card>
  )
}

function VariantIcon({ type, overdue }: { type: TimelineItem['itemType']; overdue: boolean }) {
  const s = {
    fill: 'none',
    stroke: overdue ? 'var(--hh-amber)' : 'var(--hh-accent)',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  const box = { width: 20, height: 20, viewBox: '0 0 24 24' }

  switch (type) {
    case 'result':
      return (
        <svg {...box} aria-hidden>
          <path d="M4 18 9 11l4 4 7-9" {...s} />
        </svg>
      )
    case 'med_change':
      return (
        <svg {...box} aria-hidden>
          <rect x="3" y="9" width="18" height="6" rx="3" {...s} />
          <path d="M12 9v6" {...s} />
        </svg>
      )
    case 'open_loop':
      return (
        <svg {...box} aria-hidden>
          <circle cx="12" cy="12" r="8" {...s} />
          <path d="M12 8v4.5l3 1.8" {...s} />
        </svg>
      )
    case 'needs_look':
      return (
        <svg {...box} aria-hidden>
          <path d="M12 4 3 19h18L12 4Z" {...s} />
          <path d="M12 10v4" {...s} />
          <circle cx="12" cy="16.6" r=".8" fill="var(--hh-amber)" stroke="none" />
        </svg>
      )
    case 'processing':
      return (
        <span
          aria-hidden
          className="mt-[1px] block h-4 w-4 animate-spin rounded-full border-2 border-[var(--hh-hairline)] border-t-[var(--hh-accent)]"
        />
      )
    default:
      return (
        <svg {...box} aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="2" {...s} />
          <path d="M8 9h8M8 13h8M8 17h5" {...s} />
        </svg>
      )
  }
}
