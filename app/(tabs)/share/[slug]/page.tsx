import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, X } from 'lucide-react'
import { CreateLinkFlow } from '@/components/create-link-flow'
import { Card, Meta, PageTitle } from '@/components/ui-bits'
import { capsulePresets } from '@/lib/mock'

export default async function SharePreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const preset = capsulePresets.find((p) => p.slug === slug)
  if (!preset) notFound()

  return (
    <div className="px-5">
      <Link
        href="/share"
        className="-ml-1 inline-flex min-h-10 items-center gap-1.5 text-[15px] font-medium text-primary"
      >
        <ArrowLeft className="size-4" />
        Share
      </Link>

      <PageTitle className="mt-2">{preset.title}</PageTitle>
      <Meta className="mt-1">{preset.blurb}</Meta>

      <Card className="mt-5">
        <h2 className="text-[17px] font-semibold">What they&apos;ll see</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {preset.includes.map((line) => (
            <li key={line} className="flex gap-2.5 text-[15px] leading-relaxed text-pretty">
              <Check className="mt-1 size-4 shrink-0 text-good" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-3">
        <h2 className="text-[17px] font-semibold">What stays private</h2>
        <ul className="mt-3 flex flex-col gap-2.5">
          {preset.hides.map((line) => (
            <li
              key={line}
              className="flex gap-2.5 text-[15px] leading-relaxed text-muted-foreground text-pretty"
            >
              <X className="mt-1 size-4 shrink-0" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
      </Card>

      <CreateLinkFlow slug={preset.slug} title={preset.title} expiry={preset.expiry} />
    </div>
  )
}
