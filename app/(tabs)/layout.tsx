import { redirect } from 'next/navigation'
import { currentPerson } from '@/lib/person'
import { supabaseServer } from '@/lib/supabase/server'
import { buildToday } from '@/lib/routines/today'
import { TabBar } from '@/components/shell/tab-bar'
import { PersonSwitcher } from '@/components/shell/person-switcher'

/**
 * The signed-in shell. Every tab renders inside it, so the person switcher and
 * tab bar are resolved once, server-side.
 */
export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  const { person, people, userId } = await currentPerson()
  if (!userId) redirect('/signin')
  if (!person) redirect('/onboarding')

  // Read-only: the badge must never be the thing that creates a schedule, or
  // every tab in the app would start writing routine rows.
  const { badgeCount } = await buildToday(await supabaseServer(), person.id)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-[var(--hh-hairline)] bg-[var(--hh-bg)] sm:order-first">
        <div className="hh-shell flex items-center justify-between px-4 py-3">
          <PersonSwitcher current={person} people={people} />
        </div>
      </header>

      <main className="hh-shell flex-1 px-4 pb-6">{children}</main>

      <TabBar todayBadge={badgeCount} />
    </div>
  )
}
