import Link from 'next/link'
import { Ambulance, ChevronRight, Stethoscope, Users } from 'lucide-react'
import { Card, CardHeader, Meta, PageTitle, TypeIcon } from '@/components/ui-bits'
import { capsulePresets } from '@/lib/mock'

const icons = {
  doctor: Stethoscope,
  paramedic: Ambulance,
  family: Users,
}

export default function SharePage() {
  return (
    <div className="px-5">
      <PageTitle className="pt-1">Share with a doctor</PageTitle>
      <Meta className="mt-1 max-w-[34ch]">
        Pick what someone needs to see. You choose how long it stays open, and you can turn it off at
        any time.
      </Meta>

      <div className="mt-5 flex flex-col gap-3">
        {capsulePresets.map((preset) => {
          const Icon = icons[preset.slug]
          return (
            <Card
              as={Link}
              key={preset.slug}
              href={`/share/${preset.slug}`}
              className="flex items-center gap-3"
            >
              <TypeIcon>
                <Icon className="size-4" />
              </TypeIcon>
              <div className="min-w-0 flex-1">
                <CardHeader>{preset.title}</CardHeader>
                <Meta className="mt-1 text-pretty">{preset.blurb}</Meta>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Card>
          )
        })}
      </div>

      <Card className="mt-6">
        <p className="text-[15px] font-medium">Nothing is shared until you say so</p>
        <Meta className="mt-1">
          Every page you make shows you exactly what a person can see before you send it.
        </Meta>
      </Card>
    </div>
  )
}
