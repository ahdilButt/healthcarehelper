import Link from 'next/link'
import { Card, Meta, PageTitle, PillButton } from '@/components/ui-bits'
import { carer, people } from '@/lib/mock'

export default function InvitePage() {
  const patient = people[0]

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col justify-center px-5 py-16">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-accent text-[17px] font-semibold text-primary">
          A
        </span>
        <div>
          <p className="text-[15px] font-medium">{carer.fullName}</p>
          <Meta>{carer.relationship} · {patient.name}</Meta>
        </div>
      </div>

      <PageTitle className="mt-6">{carer.name} added you to Dad&apos;s story</PageTitle>
      <p className="mt-3 max-w-[34ch] text-[15px] leading-relaxed text-muted-foreground text-pretty">
        You&apos;ll be able to see his letters, medicines and results, and help keep track of what
        changes.
      </p>

      <Card className="mt-6">
        <p className="text-[15px] font-medium">What you&apos;ll be able to do</p>
        <ul className="mt-2 flex flex-col gap-2 text-[15px] leading-relaxed">
          <li>Read the story and everything in plain English</li>
          <li>Tick off medicines on the day</li>
          <li>Make a page to share with a doctor</li>
        </ul>
      </Card>

      <div className="mt-8 flex flex-col gap-3">
        <PillButton as={Link} href="/timeline" className="w-full">
          Accept
        </PillButton>
        <Meta className="text-center">{carer.name} can remove you at any time.</Meta>
      </div>
    </div>
  )
}
