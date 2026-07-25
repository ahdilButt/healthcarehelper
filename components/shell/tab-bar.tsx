'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Timeline · Today · Ask · Share (SPEC-FINAL §9).
 * Bottom bar on a phone; becomes a top bar at desktop width.
 */
const TABS = [
  { href: '/timeline', label: 'Timeline', icon: TimelineIcon },
  { href: '/today', label: 'Today', icon: TodayIcon },
  { href: '/ask', label: 'Ask', icon: AskIcon },
  { href: '/share', label: 'Share', icon: ShareIcon },
]

export function TabBar() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-20 border-t border-[var(--hh-hairline)] bg-[var(--hh-card)] pb-[env(safe-area-inset-bottom)] sm:top-0 sm:bottom-auto sm:border-t-0 sm:border-b"
    >
      <ul className="hh-shell flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[52px] flex-col items-center justify-center gap-1 py-2 text-[13px] ${
                  active ? 'text-[var(--hh-accent)]' : 'text-[var(--hh-secondary)]'
                }`}
              >
                <Icon />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const }

function TimelineIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M5 4v16" {...s} />
      <circle cx="5" cy="8" r="2" {...s} />
      <circle cx="5" cy="16" r="2" {...s} />
      <path d="M10 8h9M10 16h6" {...s} />
    </svg>
  )
}
function TodayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="3" {...s} />
      <path d="M4 10h16M9 3v4M15 3v4" {...s} />
    </svg>
  )
}
function AskIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M20 12a8 8 0 1 1-3.2-6.4" {...s} />
      <path d="M4 20l1.6-3.7" {...s} />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3 2.45V13" {...s} />
      <circle cx="12.5" cy="16" r=".9" fill="currentColor" stroke="none" />
    </svg>
  )
}
function ShareIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <circle cx="17" cy="6" r="2.6" {...s} />
      <circle cx="7" cy="12" r="2.6" {...s} />
      <circle cx="17" cy="18" r="2.6" {...s} />
      <path d="m9.4 10.8 5.2-3.2M9.4 13.2l5.2 3.2" {...s} />
    </svg>
  )
}
