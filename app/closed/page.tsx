import { redirect } from 'next/navigation'
import { demoWindow } from '@/lib/demo/window'
import { BrandLockup } from '@/components/brand-lockup'
import { PageTitle, Meta } from '@/components/ui/primitives'

/**
 * Where every request lands once the demo has closed (proxy.ts rewrites to
 * here). It is deliberately a dead end: no sign-in, no "try again", nothing
 * that would suggest the door is only stuck.
 *
 * Dynamic because the answer depends on an environment variable read at
 * request time — a cached copy of this page would outlive its own reason to
 * exist, and worse, could be served while the demo is open again.
 */
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Aftercare — the demo has closed',
  robots: { index: false, follow: false },
}

export default function ClosedPage() {
  // Reachable while the demo is still open only by typing the URL. Sending
  // them home is kinder than a page announcing an ending that has not happened.
  if (!demoWindow().closed) redirect('/')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col items-center justify-center gap-6 px-6 text-center">
      <BrandLockup />

      <div className="flex flex-col gap-3">
        <PageTitle>The demo has closed.</PageTitle>
        <Meta className="mx-auto max-w-[38ch] text-[15px] leading-relaxed">
          Aftercare was open for a few days as a prototype. It is switched off now, and the
          records people tried it with are no longer reachable.
        </Meta>
      </div>

      <Meta className="mx-auto max-w-[38ch]">
        Thank you for having a look. Nothing you uploaded was ever shared with anyone.
      </Meta>
    </main>
  )
}
