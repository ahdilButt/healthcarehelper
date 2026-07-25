'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Camera, Heart, UserRound } from 'lucide-react'
import { Card, PageTitle, PillButton, Meta } from '@/components/ui-bits'
import { cn } from '@/lib/utils'

export function OnboardingFlow() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [who, setWho] = useState<'me' | 'someone' | null>(null)
  const [name, setName] = useState('')
  const [managing, setManaging] = useState('')

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col px-5 pb-10 pt-4">
      <div className="flex items-center gap-3">
        {step === 0 ? (
          <Link
            href="/"
            className="-ml-1 inline-flex min-h-10 items-center gap-1.5 text-[15px] font-medium text-primary"
          >
            <ArrowLeft className="size-4" />
            Back
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="-ml-1 inline-flex min-h-10 items-center gap-1.5 text-[15px] font-medium text-primary"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
        )}
        <div className="ml-auto flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={cn('h-1.5 rounded-full transition-all', i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border')}
            />
          ))}
        </div>
      </div>

      {step === 0 ? (
        <div className="flex flex-1 flex-col">
          <PageTitle className="mt-8">Whose care are you managing?</PageTitle>
          <div className="mt-8 flex flex-col gap-3">
            <ChoiceCard
              icon={<UserRound className="size-6" />}
              title="Me"
              detail="My own letters, medicines and results"
              selected={who === 'me'}
              onClick={() => {
                setWho('me')
                setStep(1)
              }}
            />
            <ChoiceCard
              icon={<Heart className="size-6" />}
              title="Someone I care for"
              detail="A parent, partner or someone else you help"
              selected={who === 'someone'}
              onClick={() => {
                setWho('someone')
                setStep(1)
              }}
            />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-1 flex-col">
          <PageTitle className="mt-8">
            {who === 'me' ? 'What should we call you?' : 'Who are you looking after?'}
          </PageTitle>
          <div className="mt-8 flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={who === 'me' ? 'Amira' : 'Dad'}
                className="min-h-12 rounded-lg border border-border bg-card px-4 text-[17px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                What are they managing?
              </span>
              <input
                value={managing}
                onChange={(e) => setManaging(e.target.value)}
                placeholder="Heart failure, diabetes…"
                className="min-h-12 rounded-lg border border-border bg-card px-4 text-[17px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-primary"
              />
              <Meta>You can leave this for now and add it later.</Meta>
            </label>
          </div>
          <div className="mt-auto flex flex-col gap-3 pt-10">
            <PillButton className="w-full" onClick={() => setStep(2)}>
              Carry on
            </PillButton>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="min-h-11 text-[15px] font-medium text-muted-foreground"
            >
              Skip for now
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-1 flex-col">
          <PageTitle className="mt-8">Add the first letter</PageTitle>
          <p className="mt-3 max-w-[32ch] text-[15px] leading-relaxed text-muted-foreground text-pretty">
            Photograph any letter, results slip or pharmacy label. We&apos;ll read it and start the
            story — you can correct anything we get wrong.
          </p>
          <div className="mt-10 flex flex-col items-center">
            <button
              type="button"
              onClick={() => router.push('/timeline')}
              className="flex size-32 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_28px_rgba(232,106,51,0.32)] active:bg-primary/90"
            >
              <Camera className="size-12" />
              <span className="sr-only">Take a photo of the first letter</span>
            </button>
            <Meta className="mt-4">Lay it flat and get all four corners in</Meta>
          </div>
          <div className="mt-auto pt-10">
            <PillButton as={Link} href="/timeline" variant="plain" className="w-full">
              I&apos;ll do this later
            </PillButton>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function ChoiceCard({
  icon,
  title,
  detail,
  selected,
  onClick,
}: {
  icon: React.ReactNode
  title: string
  detail: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <Card
      as="button"
      onClick={onClick}
      tone={selected ? 'accent' : 'plain'}
      className="flex w-full items-center gap-4 p-5 text-left"
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-[13px] text-muted-foreground">{detail}</span>
      </span>
    </Card>
  )
}
