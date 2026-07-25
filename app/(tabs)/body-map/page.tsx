import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { BodyOutline } from '@/components/illustrations'
import { Card, Meta, PageTitle } from '@/components/ui-bits'
import { patchHistory, patchPlan } from '@/lib/mock'

export default function BodyMapPage() {
  return (
    <div className="px-5">
      <Link
        href="/today"
        className="-ml-1 inline-flex min-h-10 items-center gap-1.5 text-[15px] font-medium text-primary"
      >
        <ArrowLeft className="size-4" />
        Today
      </Link>

      <PageTitle className="mt-2">Where the patch goes</PageTitle>
      <Meta className="mt-1">Move it each day so the skin gets a rest</Meta>

      <Card className="mt-5">
        <div className="relative mx-auto w-full max-w-[150px]">
          <BodyOutline className="w-full text-foreground/45" />

          {/* Dad's left hip — appears on the right as you look at him */}
          <span
            className="absolute left-[62%] top-[59%] size-2.5 rounded-full bg-muted-foreground"
            aria-hidden="true"
          />

          {/* Dad's right hip — appears on the left as you look at him */}
          <span className="absolute left-[33%] top-[59%]" aria-hidden="true">
            <span className="absolute inset-0 size-2.5 animate-site-pulse rounded-full bg-primary/40" />
            <span className="relative block size-2.5 rounded-full bg-primary" />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
          <span className="flex items-center gap-2 text-[13px] font-medium text-primary">
            <span className="size-2.5 rounded-full bg-primary" aria-hidden="true" />
            {patchPlan.next.label}
          </span>
          <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="size-2.5 rounded-full bg-muted-foreground" aria-hidden="true" />
            {patchPlan.last.label}
          </span>
        </div>

        <p className="mt-4 text-center text-[15px] font-medium">
          Today&apos;s patch goes on the right hip
        </p>
        <Meta className="mt-1 text-center">
          Take yesterday&apos;s patch off first and fold it sticky-side in.
        </Meta>
      </Card>

      <h2 className="mt-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        The last four weeks
      </h2>
      <Card className="mt-2 divide-y divide-border p-0">
        {patchHistory.map((row) => (
          <div key={row.date} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-[15px]">{row.date}</span>
            <span className="text-[15px] font-medium text-muted-foreground">{row.site}</span>
          </div>
        ))}
      </Card>
      <Meta className="mt-3">
        Sites rotate between both hips and both upper arms, so each spot gets four days off.
      </Meta>
    </div>
  )
}
