import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseService } from '@/lib/supabase/service'
import { buildCapsule, KIND_TITLE, type CapsulePayload } from '@/lib/capsules/build'
import { clientIp, logView, openCapsule, rateLimited } from '@/lib/capsules/access'
import type { CapsuleKind } from '@/lib/types'

/**
 * GET /c/[token] — PUBLIC (API-CONTRACTS.md).
 *
 * Deliberately unlike the rest of the app (SPEC-FINAL §7, decision B6): white,
 * near-black, tight fixed order, print-friendly. A clinician reading this has
 * thirty seconds and no interest in a warm family tool.
 *
 * Order of operations matters and is the whole security story: rate limit, then
 * token, then scope, then expiry and revocation — and only after all of that
 * does the service-role client touch a single row.
 */

export const dynamic = 'force-dynamic'

export default async function CapsulePage({ params }: PageProps<'/c/[token]'>) {
  const { token } = await params
  const head = await headers()

  // A dead link must answer with a dead status, which a page cannot set — the
  // handler at /c/gone does, and it is the only reason this is a redirect.
  if (rateLimited(clientIp(head))) redirect('/c/gone?reason=rate_limited')

  const service = supabaseService()
  const access = await openCapsule(service, token)
  if (!access.ok) redirect(`/c/gone?reason=${access.reason}`)

  const { capsule } = access
  await logView(service, capsule.id, head.get('user-agent'))

  const payload = await buildCapsule(service, capsule.person_id, capsule.kind)

  return (
    <main className="capsule mx-auto max-w-[46rem] px-5 py-6">
      <header className="border-b border-[#d9d9d9] pb-3">
        <p className="text-[12px] uppercase tracking-[0.08em] text-[#555]">
          {KIND_TITLE[capsule.kind as CapsuleKind]}
        </p>
        <h1 className="mt-1 text-[24px] font-semibold leading-tight">{payload.personName}</h1>
        <p className="mt-1 text-[13px] text-[#555]">
          Shared by the family · {expiryLine(capsule.expires_at)}
        </p>
      </header>

      {capsule.kind === 'paramedic' && <Emergency payload={payload} />}

      {payload.sections.map((section) => (
        <section key={section.heading} className="mt-5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-[#333]">
            {section.heading}
          </h2>
          {section.lines.length === 0 ? (
            <p className="mt-1 text-[15px] text-[#555]">{section.emptyText}</p>
          ) : (
            <ul className="mt-1">
              {section.lines.map((line, i) => (
                <li key={`${line.text}-${i}`} className="border-b border-[#ededed] py-[6px] last:border-b-0">
                  <span className="text-[15px] leading-[1.4]">{line.text}</span>
                  {line.note && <span className="block text-[13px] text-[#555]">{line.note}</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <footer className="mt-8 border-t border-[#d9d9d9] pt-3 text-[12px] leading-[1.5] text-[#555]">
        <p>
          Held by the family, not by a health service. Only entries the family has confirmed are
          shown. This is a summary, not a medical record — check anything that matters against the
          original documents.
        </p>
        <p className="mt-1">Every opening of this link is logged and it can be withdrawn at any time.</p>
      </footer>
    </main>
  )
}

function Emergency({ payload }: { payload: CapsulePayload }) {
  const contact = payload.emergencyContact
  return (
    <section className="mt-4 border border-[#111] p-3">
      {/* Always stated, even when unset. On an emergency card, "we do not know"
          is information a clinician needs; silence reads as "no". */}
      <p className="text-[15px]">
        <strong>DNACPR:</strong>{' '}
        {payload.dnr == null
          ? 'not recorded by the family — check the clinical record'
          : payload.dnr
            ? 'recorded'
            : 'no DNACPR recorded'}
      </p>
      {contact?.name && (
        <p className="mt-1 text-[15px]">
          <strong>In an emergency call:</strong> {contact.name}
          {contact.relationship ? ` (${contact.relationship})` : ''}
          {contact.phone ? ` · ${contact.phone}` : ''}
        </p>
      )}
    </section>
  )
}

function expiryLine(expiresAt: string | null): string {
  if (!expiresAt) return 'valid until it is withdrawn'
  const at = new Date(expiresAt)
  const hours = Math.round((at.getTime() - Date.now()) / 3600000)
  if (hours < 1) return 'expires within the hour'
  if (hours < 48) return `expires in ${hours} hours`
  return `expires ${at.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
}
