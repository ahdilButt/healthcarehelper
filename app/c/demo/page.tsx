import Link from 'next/link'
import { Printer } from 'lucide-react'
import {
  allergies,
  capsuleAppointments,
  capsuleInFlight,
  capsuleMeds,
  capsuleProblems,
  capsuleResults,
  carer,
  emergency,
  people,
} from '@/lib/mock'

type Variant = 'doctor' | 'paramedic' | 'family'

const expiryLine: Record<Variant, string> = {
  doctor: 'expires in 24h',
  paramedic: 'stays available until turned off',
  family: 'expires in 30 days',
}

export default async function CapsulePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>
}) {
  const { v } = await searchParams
  const variant: Variant = v === 'paramedic' || v === 'family' ? v : 'doctor'
  const patient = people[0]

  if (variant === 'paramedic') return <ParamedicCard />

  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-5">
      <CapsuleHeader variant={variant} />

      <h1 className="mt-4 text-[20px] font-semibold leading-tight">
        {patient.name}
        <span className="ml-2 text-[14px] font-normal text-muted-foreground">
          born {emergency.dob} · NHS {emergency.nhs}
        </span>
      </h1>

      {variant === 'doctor' ? (
        <>
          <Section title="Allergies" tone="alert">
            <ul className="flex flex-col gap-1">
              {allergies.map((a) => (
                <li key={a.name} className="text-[15px] font-semibold">
                  {a.name}
                  <span className="ml-2 font-normal text-foreground/70">{a.note}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Current medications">
            <Rows
              rows={capsuleMeds.map((m) => ({
                left: `${m.name} ${m.dose}`,
                right: m.when,
                note: m.note,
              }))}
            />
          </Section>

          <Section title="Active problems">
            <Rows rows={capsuleProblems.map((p) => ({ left: p.name, right: p.detail }))} />
          </Section>

          <Section title="Recent results">
            <Rows
              rows={capsuleResults.map((r) => ({
                left: r.name,
                right: `${r.value} · ${r.date}`,
              }))}
            />
          </Section>

          <Section title="In flight">
            <Rows rows={capsuleInFlight.map((r) => ({ left: r.name, right: r.detail }))} />
          </Section>

          <Section title="Contacts">
            <Rows
              rows={[
                { left: 'Next of kin', right: emergency.contact },
                { left: 'GP practice', right: emergency.gp },
                { left: 'Resuscitation', right: emergency.resus },
              ]}
            />
          </Section>
        </>
      ) : (
        <>
          <Section title="Medications">
            <Rows
              rows={capsuleMeds.map((m) => ({ left: `${m.name} ${m.dose}`, right: m.when }))}
            />
          </Section>
          <Section title="Appointments">
            <Rows rows={capsuleAppointments.map((a) => ({ left: a.name, right: a.detail }))} />
          </Section>
          <p className="mt-6 border border-border p-3 text-[13px] text-muted-foreground">
            Results, letters and conditions are not included in this view.
          </p>
        </>
      )}

      <CapsuleFooter variant={variant} />
    </div>
  )
}

function CapsuleHeader({ variant }: { variant: Variant }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-foreground pb-2">
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em]">
        HealthcareHelper
        <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground">
          shared by {carer.name} · {expiryLine[variant]}
        </span>
      </p>
      <span className="no-print inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
        <Printer className="size-4" />
        Print or save as PDF
      </span>
    </header>
  )
}

function CapsuleFooter({ variant }: { variant: Variant }) {
  return (
    <footer className="mt-8 border-t border-border pt-3 text-[13px] text-muted-foreground">
      <p>
        Compiled from documents supplied by the family. Generated 24 May 2026 · {expiryLine[variant]}.
        Not a clinical record.
      </p>
      <p className="no-print mt-2">
        <Link href="/c/expired" className="underline underline-offset-2">
          See what happens when this link is turned off
        </Link>
      </p>
    </footer>
  )
}

function Section({
  title,
  children,
  tone = 'plain',
}: {
  title: string
  children: React.ReactNode
  tone?: 'plain' | 'alert'
}) {
  return (
    <section className="mt-5">
      <h2
        className={`text-[13px] font-bold uppercase tracking-[0.08em] ${
          tone === 'alert' ? 'text-alert' : 'text-foreground'
        }`}
      >
        {title}
      </h2>
      <div
        className={`mt-1.5 border p-3 ${
          tone === 'alert' ? 'border-alert/40 bg-alert-wash' : 'border-border'
        }`}
      >
        {children}
      </div>
    </section>
  )
}

function Rows({ rows }: { rows: { left: string; right: string; note?: string }[] }) {
  return (
    <dl className="divide-y divide-border">
      {rows.map((row, i) => (
        <div
          key={`${row.left}-${i}`}
          className="flex flex-col gap-0.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        >
          <dt className="text-[15px] font-semibold">{row.left}</dt>
          <dd className="text-[15px] sm:text-right">
            {row.right}
            {row.note ? (
              <span className="block text-[13px] text-muted-foreground">{row.note}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ParamedicCard() {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 pb-16 pt-5">
      <CapsuleHeader variant="paramedic" />

      <h1 className="mt-4 text-[26px] font-bold leading-tight">{people[0].name}</h1>
      <p className="text-[17px]">
        Born {emergency.dob} · NHS {emergency.nhs}
      </p>

      <div className="mt-4 border-2 border-alert bg-alert-wash p-4">
        <h2 className="text-[15px] font-bold uppercase tracking-[0.08em] text-alert">Allergies</h2>
        <p className="mt-1 text-[26px] font-bold leading-tight text-alert">PENICILLIN</p>
        <p className="text-[17px]">Rash and swelling, 2019</p>
      </div>

      <div className="mt-4 border-2 border-foreground p-4">
        <h2 className="text-[15px] font-bold uppercase tracking-[0.08em]">Key medications</h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[20px] font-semibold leading-snug">
          <li>Ramipril 5mg each morning</li>
          <li>Bisoprolol 2.5mg each morning</li>
          <li>Furosemide 40mg each morning</li>
          <li>GTN patch 5mg each morning</li>
          <li>Metformin 1g twice daily</li>
        </ul>
      </div>

      <div className="mt-4 border-2 border-foreground p-4">
        <h2 className="text-[15px] font-bold uppercase tracking-[0.08em]">Being managed</h2>
        <p className="mt-1 text-[20px] font-semibold leading-snug">
          Heart failure · Type 2 diabetes · Reduced kidney function (eGFR 46, May 2026)
        </p>
      </div>

      <div className="mt-4 border-2 border-foreground p-4">
        <h2 className="text-[15px] font-bold uppercase tracking-[0.08em]">Emergency contact</h2>
        <p className="mt-1 text-[20px] font-semibold">{emergency.contact}</p>
        <p className="mt-3 text-[17px] font-bold uppercase">{emergency.resus}</p>
      </div>

      <CapsuleFooter variant="paramedic" />
    </div>
  )
}
