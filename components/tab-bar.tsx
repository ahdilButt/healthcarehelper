'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { CalendarDays, Clock3, MessageCircleHeart, Share2 } from 'lucide-react'
import { todayBadgeCount } from '@/lib/mock'
import { cn } from '@/lib/utils'

const tabs = [
  { href: '/timeline', label: 'Timeline', icon: Clock3 },
  { href: '/today', label: 'Today', icon: CalendarDays, badge: todayBadgeCount },
  { href: '/ask', label: 'Ask', icon: MessageCircleHeart },
  { href: '/share', label: 'Share', icon: Share2 },
]

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-[720px] items-stretch">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href)
          const Icon = tab.icon
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex flex-col items-center gap-1 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 text-[11px] font-medium',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icon className="size-6" strokeWidth={active ? 2.2 : 1.8} />
                  {tab.badge ? (
                    <span className="absolute -right-1.5 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                      {tab.badge}
                      <span className="sr-only">thing to do</span>
                    </span>
                  ) : null}
                </span>
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
