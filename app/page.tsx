import Link from 'next/link'
import { Camera, MessageCircleQuestion, ShieldCheck, Sparkles } from 'lucide-react'
import { BrandLockup } from '@/components/brand-lockup'
import { PageTitle, PillButton, TypeIcon } from '@/components/ui-bits'

const features = [
  {
    icon: Camera,
    title: 'Snap a letter',
    body: 'Photograph any hospital letter or label and get it in plain English.',
  },
  {
    icon: Sparkles,
    title: 'See what changed',
    body: 'A simple timeline of medicines, results and appointments.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Ask anything',
    body: 'Questions answered using only what is in your own records.',
  },
]

export default function WelcomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col px-5 pb-10 pt-10">
      <header className="flex flex-col items-center text-center">
        <BrandLockup />
        <PageTitle className="mt-8">
          Keep the whole story in one place — letters, medicines, results.
        </PageTitle>
        <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-muted-foreground text-pretty">
          Photograph a letter and we&apos;ll turn it into plain English, keep track of what changed,
          and help you share it safely when someone needs it.
        </p>
      </header>

      <ul className="mt-10 flex flex-col gap-3">
        {features.map((feature) => (
          <li
            key={feature.title}
            className="flex items-start gap-3 rounded-lg border border-border bg-card p-4"
          >
            <TypeIcon>
              <feature.icon className="size-4" />
            </TypeIcon>
            <div className="flex flex-col gap-1">
              <h2 className="text-[15px] font-semibold leading-snug">{feature.title}</h2>
              <p className="text-[14px] leading-relaxed text-muted-foreground text-pretty">
                {feature.body}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col gap-3">
        <PillButton as={Link} href="/onboarding" className="w-full">
          Get started
        </PillButton>
        <PillButton as={Link} href="/timeline" variant="plain" className="w-full">
          See the demo story
        </PillButton>
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-center text-[13px] text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-good" aria-hidden="true" />
        Private by default. Nothing is shared until you create a link.
      </p>
    </main>
  )
}
