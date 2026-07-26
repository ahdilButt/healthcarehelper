'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { PersonSummary } from '@/lib/types'
import { setCurrentPerson, signOut } from '@/app/actions'
import { InvitePanel } from './invite-panel'

/** Top-left switcher: Amira ⇄ "Dad's story", settings behind it (SPEC-FINAL §9). */
export function PersonSwitcher({
  current,
  people,
  email,
}: {
  current: PersonSummary
  people: PersonSummary[]
  email?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [inviting, setInviting] = useState(false)

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

  // Even with one person the menu has to open: it is the only way out of a
  // session, and a magic-link session does not expire on its own.
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
        <div className="absolute left-0 z-30 mt-1 min-w-[230px] overflow-hidden rounded-[16px] border border-border bg-card shadow-sm">
          {people.length > 1 && (
            <ul className="border-b border-border">
              {people.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => choose(p.id)}
                    className={`block min-h-[44px] w-full px-4 py-3 text-left text-[15px] ${
                      p.id === current.id ? 'text-primary' : ''
                    }`}
                  >
                    {p.displayName}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Bringing a second person into THIS record, rather than forwarding
              a sign-in link — which does not add them, it makes them you. */}
          {current.role === 'owner' && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                setInviting(true)
              }}
              className="block min-h-[44px] w-full border-b border-border px-4 py-3 text-left text-[15px] text-primary"
            >
              Invite someone to {current.displayName}&rsquo;s story
            </button>
          )}

          {/* The only way to start a second, empty record without wiping the
              first — which is what testing from scratch otherwise costs. */}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              router.push('/onboarding')
            }}
            className="block min-h-[44px] w-full border-b border-border px-4 py-3 text-left text-[15px] text-primary"
          >
            Add someone else
          </button>

          {/* No email means an anonymous guest session. Saying so matters:
              leaving is the one door that does not open again — there is no
              address to send a link back to. */}
          <p className="truncate px-4 pt-3 text-[13px] leading-[1.4] text-muted-foreground">
            {email
              ? `Signed in as ${email}`
              : 'Looking around as a guest. This copy is only on this device.'}
          </p>

          <form action={signOut}>
            <button
              type="submit"
              className="block min-h-[44px] w-full px-4 py-3 text-left text-[15px] text-muted-foreground"
            >
              {email ? 'Sign out' : 'Leave the demo (this copy is discarded)'}
            </button>
          </form>
        </div>
      )}

      {inviting && (
        <InvitePanel
          personId={current.id}
          personName={current.displayName}
          onClose={() => setInviting(false)}
        />
      )}
    </div>
  )
}
