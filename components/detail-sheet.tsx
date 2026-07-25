'use client'

import { useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, Pencil, ScanLine } from 'lucide-react'
import { BottomSheet } from '@/components/bottom-sheet'
import { PillButton, SourceChip, StatusPill } from '@/components/ui-bits'
import type { TimelineItem } from '@/lib/mock'

export function DetailSheet({ item, onClose }: { item: TimelineItem | null; onClose: () => void }) {
  const [showOriginal, setShowOriginal] = useState(false)

  function close() {
    setShowOriginal(false)
    onClose()
  }

  if (!item) return null

  return (
    <BottomSheet open={!!item} onClose={close} title={item.header}>
      {showOriginal ? (
        <div>
          <button
            type="button"
            onClick={() => setShowOriginal(false)}
            className="-ml-1 inline-flex min-h-10 items-center gap-1.5 text-[15px] font-medium text-primary"
          >
            <ArrowLeft className="size-4" />
            Back to the details
          </button>
          <div className="mt-3 overflow-hidden rounded-lg border border-border bg-muted">
            <Image
              src="/letter-scan.png"
              alt={`Photo of the original ${item.header.toLowerCase()}`}
              width={900}
              height={1200}
              className="h-auto w-full"
            />
          </div>
          <p className="mt-3 text-[13px] text-muted-foreground">
            {item.source ?? 'Photographed by you'}
          </p>
        </div>
      ) : (
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {item.statusPill ? (
              <StatusPill tone={item.statusPill.tone}>{item.statusPill.text}</StatusPill>
            ) : null}
            {item.source ? <SourceChip label={item.source} /> : null}
          </div>

          <dl className="mt-4 divide-y divide-border">
            {(item.facts ?? []).map((fact) => (
              <div key={fact.label} className="flex items-start justify-between gap-4 py-3">
                <dt className="text-[15px] text-muted-foreground">{fact.label}</dt>
                <dd className="flex items-center gap-2 text-right text-[15px] font-medium">
                  {fact.value}
                  {fact.edited ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-normal text-muted-foreground">
                      <Pencil className="size-3" />
                      edited
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          {item.plainEnglish ? (
            <section className="mt-5 rounded-lg bg-accent p-4">
              <h3 className="text-[17px] font-semibold">What this letter says</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-foreground/85 text-pretty">
                {item.plainEnglish}
              </p>
            </section>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <PillButton variant="quiet" className="flex-1" onClick={close}>
              <Pencil className="size-4" />
              Fix this
            </PillButton>
            <PillButton variant="plain" className="flex-1" onClick={() => setShowOriginal(true)}>
              <ScanLine className="size-4" />
              View the original letter
            </PillButton>
          </div>
        </div>
      )}
    </BottomSheet>
  )
}
