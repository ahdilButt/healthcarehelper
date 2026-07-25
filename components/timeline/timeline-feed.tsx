'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { TimelineItem } from '@/lib/types'
import { monthLabel } from '@/lib/timeline/build'
import { EmptyState, MonthHeader } from '@/components/ui/primitives'
import { ShoeboxIllustration } from '@/components/ui/illustrations'
import { TimelineCard } from './timeline-card'
import { AddLetterButton } from './add-letter'
import { DetailSheet } from './detail-sheet'
import { MergePrompt } from './merge-prompt'

interface Duplicate {
  documentId: string
  duplicateOfId: string
  label?: string
}

/**
 * Flat feed with sticky month headers (SPEC-FINAL §4). Polls while anything is
 * still processing so the narration card resolves itself into real cards, and
 * asks the server which merge prompts are still owed — that answer belongs to
 * the record, so it survives a reload rather than dying with the page.
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
  const [watching, setWatching] = useState<string[]>([])
  const [duplicates, setDuplicates] = useState<Duplicate[]>([])
  const [autoOpen, setAutoOpen] = useState(autoOpenCamera)
  const [tick, setTick] = useState(0)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/persons/${personId}/timeline?limit=60`)
    if (!res.ok) return
    const body = (await res.json()) as { items: TimelineItem[] }
    if (live.current) setItems(body.items)
  }, [personId])

  // Settled in promise callbacks rather than an async body, so the mount effect
  // below never sets state synchronously.
  const checkDuplicates = useCallback(
    () =>
      fetch(`/api/persons/${personId}/duplicates`)
        .then((res) => (res.ok ? (res.json() as Promise<{ pairs: Duplicate[] }>) : null))
        .then((body) => {
          if (!live.current || !body?.pairs.length) return
          setDuplicates((prev) => {
            const known = new Set(prev.map((p) => p.documentId))
            const fresh = body.pairs.filter((p) => !known.has(p.documentId))
            return fresh.length ? [...prev, ...fresh] : prev
          })
        })
        // The prompt is owed by the record, so the next load offers it again.
        .catch(() => {}),
    [personId]
  )

  useEffect(() => {
    void checkDuplicates()
  }, [checkDuplicates])

  const added = useCallback(
    (documentIds: string[]) => {
      setAutoOpen(false)
      if (documentIds.length) {
        setWatching((prev) => [...prev, ...documentIds.filter((id) => !prev.includes(id))])
      }
      void refresh()
    },
    [refresh]
  )

  const closeDetail = useCallback(() => setDetail(null), [])

  const processing = items.some((i) => i.itemType === 'processing')

  // Re-arming on `tick` rather than on `items` means one failed poll — a dropped
  // packet mid-ingest — cannot leave the narration card spinning for ever.
  useEffect(() => {
    if (!processing) return
    const timer = setTimeout(() => {
      refresh()
        .catch(() => {})
        .finally(() => {
          if (live.current) setTick((n) => n + 1)
        })
    }, 2000)
    return () => clearTimeout(timer)
  }, [processing, tick, refresh])

  useEffect(() => {
    if (!watching.length) return
    let cancelled = false

    const timer = setInterval(async () => {
      const settled: string[] = []
      for (const id of watching) {
        try {
          const res = await fetch(`/api/documents/${id}`)
          if (!res.ok) {
            settled.push(id)
            continue
          }
          const body = (await res.json()) as { document: { status: string } }
          if (body.document.status !== 'processing') settled.push(id)
        } catch {
          settled.push(id) // a document we cannot reach is not worth hammering
        }
      }

      if (cancelled || !settled.length) return
      setWatching((prev) => prev.filter((id) => !settled.includes(id)))
      void refresh()
      void checkDuplicates()
    }, 2000)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [watching, refresh, checkDuplicates])

  const groups: { month: string; items: TimelineItem[] }[] = []
  for (const item of items) {
    const month = monthLabel(item.date)
    const last = groups[groups.length - 1]
    if (last && last.month === month) last.items.push(item)
    else groups.push({ month, items: [item] })
  }

  const pending = duplicates[0]

  return (
    <>
      {/* One button, never re-mounted: an upload error must survive the moment
          the first letter turns an empty story into a full one. */}
      <div className="flex items-center justify-between gap-3 py-4">
        <h1 className="text-[28px] font-semibold leading-[1.2]">The story</h1>
        <AddLetterButton personId={personId} onAdded={added} autoOpen={autoOpen} />
      </div>

      {pending && (
        <MergePrompt
          documentId={pending.documentId}
          duplicateOfId={pending.duplicateOfId}
          label={pending.label}
          onResolved={() => {
            setDuplicates((prev) => prev.filter((p) => p.documentId !== pending.documentId))
            void refresh()
          }}
        />
      )}

      {items.length === 0 ? (
        <EmptyState
          illustration={<ShoeboxIllustration />}
          title="Nothing here yet"
          body="Add the first letter — photograph it and watch the story build."
        />
      ) : (
        groups.map((g) => (
          <section key={g.month}>
            <MonthHeader label={g.month} />
            <ul className="mt-2">
              {g.items.map((item) => (
                <TimelineCard key={`${item.itemType}:${item.id}`} item={item} onOpen={setDetail} />
              ))}
            </ul>
          </section>
        ))
      )}

      {detail && (
        <DetailSheet item={detail} onClose={closeDetail} onChanged={refresh} onAdded={added} />
      )}
    </>
  )
}
