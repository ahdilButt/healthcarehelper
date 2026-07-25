import Link from 'next/link'
import { Users } from 'lucide-react'
import { PersonProvider } from '@/components/person-context'
import { PersonSwitcher } from '@/components/person-switcher'
import { TabBar } from '@/components/tab-bar'

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <PersonProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/92 px-5 pb-2 pt-3 backdrop-blur">
          <PersonSwitcher />
          <Link
            href="/invite"
            className="flex size-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground active:bg-muted"
          >
            <Users className="size-5" />
            <span className="sr-only">People who can see this story</span>
          </Link>
        </header>
        <main className="flex-1 pb-36">{children}</main>
        <TabBar />
      </div>
    </PersonProvider>
  )
}
