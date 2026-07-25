'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimelineItem } from '@/lib/types'
import { monthLabel } from '@/lib/timeline/build'
import { EmptyState, MonthHeader, Button } from '@/components/ui/primitives'
import { ShoeboxIllustration } from '@/components/ui/illustrations'
import { TimelineCard } from './timeline-card'
import { AddLetterButton } from './add-letter'

/**
 * Flat feed with sticky month headers (SPEC-FINAL §4). Polls while anything is
 * still processing so the narration card resolves itself into real cards.
 */
export function TimelineFeed({
  personId,
  initialItems,
  autoOpenCamera = false,
}: {
  personId: string
  initialItems: TimelineItem[]
  autoOpenCamera?: boolean
}) {
  const [items, setItems] = useState(initialItems)
  const [detail, setDetail] = useState<TimelineItem | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/persons/${personId}/timeline?limit=60`)
    if (!res.ok) return
    const body = (await res.json()) as { items: TimelineItem[] }
    setItems(body.items)
  }, [personId])

  const processing = items.some((i) => i.itemType === 'processing')

  useEffect(() => {
    if (!processing) return
    timer.current = setTimeout(refresh, 2000)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [processing, items, refresh])

  if (!items.length) {
    return (
      <EmptyState
        illustration={<ShoeboxIllustration />}
        title="Nothing here yet"
        body="Add the first letter — photograph it and watch the story build."
        action={<AddLetterButton personId={personId} onAdded={refresh} autoOpen={autoOpenCamera} />}
      />
    )
  }

  const groups: { month: string; items: TimelineItem[] }[] = []
  for (const item of items) {
    const month = monthLabel(item.date)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.items.push(item)
    else groups.push({ month, items: [item] })
  }

  return (
    <>
      <div className="flex items-center justify-between py-4">
        <h1 className="text-[28px] font-semibold leading-[1.2]">The story</h1>
        <AddLetterButton personId={personId} onAdded={refresh} autoOpen={autoOpenCamera} />
      </div>

      {groups.map((g) => (
        <section key={g.month}>
          <MonthHeader label={g.month} />
          <ul className="mt-2">
            {g.items.map((item) => (
              <TimelineCard key={`${item.itemType}:${item.id}`} item={item} onOpen={setDetail} />
            ))}
          </ul>
        </section>
      ))}

      {detail && <DetailSheet item={detail} onClose={() => setDetail(null)} onChanged={refresh} />}
    </>
  )
}

/** Minimal detail sheet — full "Fix this" overlay and translation land in Stage 7. */
function DetailSheet({
  item,
  onClose,
  onChanged,
}: {
  item: TimelineItem
  onClose: () => void
  onChanged: () => void
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.humanTitle}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="hh-shell max-h-[85dvh] w-full overflow-y-auto rounded-t-[16px] bg-[var(--hh-card)] p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[17px] font-semibold">{item.humanTitle}</h2>
        <p className="mt-2 text-[15px]">{item.payloadLine}</p>
        <p className="mt-3 text-[13px] text-[var(--hh-secondary)]">{item.sourceChip.label}</p>

        <div className="mt-5 flex flex-col gap-2">
          <a
            href={`/api/documents/${item.sourceChip.documentId}/file`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--hh-hairline)] px-5 text-[15px]"
          >
            View the original letter
          </a>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <span className="sr-only" onClick={onChanged} />
      </div>
    </div>
  )
}
