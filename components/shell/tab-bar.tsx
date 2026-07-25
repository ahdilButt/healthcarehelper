'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Clock3, MessageCircleHeart, Share2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Timeline · Today · Ask · Share (SPEC-FINAL §9), in the design lane's shape.
 * Bottom bar on a phone; the badge is the whole of in-app notification.
 */
const TABS = [
  { href: '/timeline', label: 'Timeline', icon: Clock3 },
  { href: '/today', label: 'Today', icon: CalendarDays },
  { href: '/ask', label: 'Ask', icon: MessageCircleHeart },
  { href: '/share', label: 'Share', icon: Share2 },
]

export function TabBar({ todayBadge = 0 }: { todayBadge?: number }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="sticky bottom-0 z-20 border-t border-border bg-card/95 backdrop-blur"
    >
      <ul className="hh-shell flex items-stretch">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          const badge = href === '/today' ? todayBadge : 0
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 px-1 pt-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.2 : 1.8} />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {badge > 9 ? '9' : badge}
                    </span>
                  )}
                </span>
                {label}
                {badge > 0 && <span className="sr-only">{badge} due</span>}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
