import Link from 'next/link'
import { ShoeboxIllustration } from '@/components/illustrations'
import { PageTitle, PillButton } from '@/components/ui-bits'

export default function WelcomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col justify-between px-5 pb-10 pt-16">
      <div>
        <p className="text-[15px] font-medium text-primary">HealthcareHelper</p>
        <PageTitle className="mt-3">
          Keep the whole story in one place — letters, medicines, results.
        </PageTitle>
        <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-muted-foreground text-pretty">
          Photograph a letter and we&apos;ll turn it into plain English, keep track of what changed,
          and help you share it safely when someone needs it.
        </p>
      </div>

      <ShoeboxIllustration className="mx-auto my-10 w-52 text-primary" />

      <div className="flex flex-col gap-3">
        <PillButton as={Link} href="/onboarding" className="w-full">
          Get started
        </PillButton>
        <PillButton as={Link} href="/timeline" variant="plain" className="w-full">
          See the demo story
        </PillButton>
      </div>
    </div>
  )
}
