'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PersonSummary } from '@/lib/types'
import { setCurrentPerson } from '@/app/actions'

/** Top-left switcher: Amira ⇄ "Dad's story" (SPEC-FINAL §9). */
export function PersonSwitcher({
  current,
  people,
}: {
  current: PersonSummary
  people: PersonSummary[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function choose(id: string) {
    setOpen(false)
    startTransition(async () => {
      await setCurrentPerson(id)
      // revalidatePath alone updates the layout but leaves the page segment
      // in the client router cache, so the previous person's (empty) feed
      // stays on screen. Refresh drops that cache.
      router.refresh()
    })
  }

  const title =
    current.role === 'owner' && people.length > 1
      ? `${current.displayName}'s story`
      : current.displayName

  if (people.length < 2) {
    return <span className="text-[17px] font-semibold">{title}</span>
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={pending}
        className="flex min-h-[44px] items-center gap-1 text-[17px] font-semibold"
      >
        {title}
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
          <path
            d="m7 10 5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open && (
        <ul className="absolute left-0 z-30 mt-1 min-w-[200px] overflow-hidden rounded-[16px] border border-[var(--hh-hairline)] bg-[var(--hh-card)] shadow-sm">
          {people.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => choose(p.id)}
                className={`block w-full px-4 py-3 text-left text-[15px] ${
                  p.id === current.id ? 'text-[var(--hh-accent)]' : ''
                }`}
              >
                {p.displayName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
