import { redirect } from 'next/navigation'
import { currentPerson } from '@/lib/person'
import { supabaseServer } from '@/lib/supabase/server'
import { buildCapsule, type CapsulePayload } from '@/lib/capsules/build'
import { ShareManager, type CapsuleSummary } from '@/components/share/share-manager'
import type { CapsuleKind } from '@/lib/types'

const KINDS: CapsuleKind[] = ['doctor_brief', 'paramedic', 'family']

/**
 * All three previews are built here, server-side, from the same function the
 * public page uses — so "what they will see" is the same code path as what
 * they actually see, not a second description of it that can drift.
 */
export default async function SharePage() {
  const { person } = await currentPerson()
  if (!person) redirect('/onboarding')

  const db = await supabaseServer()
  const built = await Promise.all(KINDS.map((kind) => buildCapsule(db, person.id, kind)))
  const previews = Object.fromEntries(KINDS.map((k, i) => [k, built[i]])) as Record<
    CapsuleKind,
    CapsulePayload
  >

  const { data: subject } = await db
    .from('persons')
    .select('dnr_status')
    .eq('id', person.id)
    .maybeSingle()

  const { data: capsules } = await db
    .from('capsules')
    .select('id, kind, token, expires_at, revoked_at, created_at')
    .eq('person_id', person.id)
    .order('created_at', { ascending: false })

  const ids = (capsules ?? []).map((c) => c.id)
  const { data: views } = ids.length
    ? await db
        .from('capsule_views')
        .select('capsule_id, viewed_at')
        .in('capsule_id', ids)
        .order('viewed_at', { ascending: false })
    : { data: [] }

  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const initialCapsules: CapsuleSummary[] = (capsules ?? []).map((c) => ({
    id: c.id as string,
    kind: c.kind as CapsuleKind,
    url: `${base}/c/${c.token as string}`,
    expiresAt: c.expires_at as string | null,
    revokedAt: c.revoked_at as string | null,
    createdAt: c.created_at as string,
    views: (views ?? [])
      .filter((v) => v.capsule_id === c.id)
      .map((v) => ({ viewedAt: v.viewed_at as string })),
  }))

  return (
    <ShareManager
      personId={person.id}
      personName={person.displayName}
      previews={previews}
      initialCapsules={initialCapsules}
      initialDnr={(subject?.dnr_status as boolean | null) ?? null}
      isOwner={person.role === 'owner'}
    />
  )
}
