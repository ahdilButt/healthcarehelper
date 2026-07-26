import Link from 'next/link'
import { CalendarCheck, Camera, ShieldCheck, Share2, Users } from 'lucide-react'
import { BrandLockup } from '@/components/brand-lockup'
import { PageTitle, PillButton, TypeIcon } from '@/components/ui-bits'
import { DemoCountdown } from '@/components/shell/demo-countdown'
import { TryDemoButton } from '@/components/shell/try-demo-button'
import { demoWindow } from '@/lib/demo/window'

/**
 * Rendered per request rather than at build: the closing date is an
 * environment variable someone can move in Vercel, and a prerendered copy of
 * this page would keep promising the old one.
 */
export const dynamic = 'force-dynamic'

/**
 * The first screen (ONBOARDING-PAGE-SPEC).
 *
 * Emotionally dense, not feature-dense. Four clusters carry all fifteen
 * capabilities honestly; the stretch lane is a plain sentence underneath
 * rather than a fifth card, because a promise in a card reads as shipped.
 * The full tour lives one tap away behind "See the demo story".
 */
const features = [
  {
    icon: Camera,
    title: 'Understand everything, instantly',
    body: "Snap a letter or upload a record and get it back in plain English. Ask anything — “what did the cardiologist change?” — and the answer comes straight from their own documents, never guesswork.",
  },
  {
    icon: CalendarCheck,
    title: 'Never miss a beat, day to day',
    body: 'A daily list of what is due, reminders that leave the app, and exactly where the last patch went. When a letter changes a dose, everyone caring for them finds out.',
  },
  {
    icon: Share2,
    title: 'Share it in one tap',
    body: 'A QR code or link that gives a doctor, a paramedic or a family member everything they need right now — without you repeating a word.',
  },
  {
    icon: Users,
    title: 'Care for more than one person',
    body: 'Separate, organised records for everyone you look after — a parent, a partner, a child — each with its own timeline, medicines and people who can help.',
  },
]

/** Order of arrival, in milliseconds — see the motion spec. */
const delay = (ms: number) => ({ animationDelay: `${ms}ms` })

export default function WelcomePage() {
  const { closesAt } = demoWindow()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col px-5 pt-10 pb-10">
      {/* Full-bleed inside a padded column, so it reads as a strip across the
          top rather than a card someone might mistake for content. */}
      {closesAt && (
        <div className="-mx-5 -mt-10 mb-8">
          <DemoCountdown closesAt={closesAt.toISOString()} />
        </div>
      )}

      <header className="flex flex-col items-center text-center">
        <div className="hh-settle rounded-2xl">
          <BrandLockup />
        </div>

        {/* Wrapped rather than styled directly: PageTitle belongs to the design
            lane and takes no style prop — not worth widening its API for one
            animation delay. */}
        <div className="hh-rise mt-8" style={delay(350)}>
          <PageTitle>
            You&rsquo;re already carrying everything for them.
            <br />
            Let this carry the details.
          </PageTitle>
        </div>

        <p
          className="hh-rise mt-4 max-w-[42ch] text-[15px] leading-relaxed text-pretty text-muted-foreground"
          style={delay(500)}
        >
          Every letter, every medicine, every appointment — understood, tracked, and ready to share
          in one link. So nothing falls through the cracks, and you never have to explain it all
          again.
        </p>
      </header>

      <ul className="mt-10 flex flex-col gap-3">
        {features.map((feature, i) => (
          <li
            key={feature.title}
            className="hh-rise flex items-start gap-3 rounded-lg border border-border bg-card p-4"
            style={delay(650 + i * 90)}
          >
            <TypeIcon>
              <feature.icon className="size-4" />
            </TypeIcon>
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] leading-snug font-semibold">{feature.title}</h2>
              <p className="text-[14px] leading-relaxed text-pretty text-muted-foreground">
                {feature.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {/* A strip, not a card: these are additive, and a card would promise
          them as core. */}
      <p
        className="hh-rise mt-4 px-1 text-[14px] leading-relaxed text-pretty text-muted-foreground"
        style={delay(1020)}
      >
        <span className="font-medium text-foreground">Plus:</span> voice notes after every
        appointment, spoken answers you can just ask out loud, and reminders that reach the whole
        family — not just you.
      </p>

      <div className="mt-10 flex flex-col gap-3">
        <PillButton as={Link} href="/onboarding" className="hh-rise w-full" style={delay(1150)}>
          Get started
        </PillButton>
        {/* Was a link to /timeline, which sent a stranger straight to a
            sign-in form. It now provisions them a private copy of the demo
            record — the door this screen was already promising. */}
        <TryDemoButton className="hh-rise w-full" style={delay(1220)} />
      </div>

      <p
        className="hh-rise mt-6 flex items-center justify-center gap-2 text-center text-[13px] text-muted-foreground"
        style={delay(1350)}
      >
        <ShieldCheck className="size-4 shrink-0 text-good" aria-hidden="true" />
        Private by default. Nothing leaves this app until you decide to share it.
      </p>
    </main>
  )
}
