'use client'

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { people } from '@/lib/mock'
import { usePerson } from '@/components/person-context'
import { cn } from '@/lib/utils'

export function PersonSwitcher() {
  const [open, setOpen] = useState(false)
  const { person, setPersonId } = usePerson()

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card pl-1.5 pr-3 text-[15px] font-medium active:bg-muted"
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-primary">
          {person.shortLabel.slice(0, 2)}
        </span>
        {person.label}
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute left-0 z-40 mt-2 w-64 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-[0_8px_24px_rgba(32,26,23,0.08)]">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPersonId(p.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-muted"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-primary">
                  {p.shortLabel.slice(0, 2)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">{p.label}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{p.name}</span>
                </span>
                {p.id === person.id ? <Check className="size-4 shrink-0 text-primary" /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
