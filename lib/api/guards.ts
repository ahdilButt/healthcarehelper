import type { SupabaseClient } from '@supabase/supabase-js'
import { ApiError } from './errors'
import { supabaseServer } from '@/lib/supabase/server'
import type { MembershipRole } from '@/lib/types'

export interface Caller {
  userId: string
  email: string | null
  db: SupabaseClient
}

/**
 * Non-negotiable #1 (API-CONTRACTS.md): membership checks in handlers are the
 * front line, RLS is the backstop. Every member-scoped route starts here.
 */
export async function requireUser(): Promise<Caller> {
  const db = await supabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) throw new ApiError('unauthorized', 'Please sign in.')
  return { userId: user.id, email: user.email ?? null, db }
}

export interface Membership extends Caller {
  personId: string
  role: MembershipRole
}

/** Caller must be a member of `personId`. Returns their role. */
export async function requireMember(personId: string): Promise<Membership> {
  const caller = await requireUser()
  const { data, error } = await caller.db
    .from('memberships')
    .select('role')
    .eq('person_id', personId)
    .eq('user_id', caller.userId)
    .maybeSingle()
  if (error) throw new ApiError('processing_failed', 'Could not check access.')
  if (!data) throw new ApiError('forbidden', 'You do not have access to this record.')
  return { ...caller, personId, role: data.role as MembershipRole }
}

export async function requireOwner(personId: string): Promise<Membership> {
  const m = await requireMember(personId)
  if (m.role !== 'owner') throw new ApiError('forbidden', 'Only the owner can do that.')
  return m
}

/**
 * Resolves the person a row belongs to, then checks membership.
 * Used by routes keyed on a document/fact/capsule id rather than a person id.
 */
export async function requireMemberOfRow(
  table: string,
  id: string,
  column = 'person_id'
): Promise<{ membership: Membership; row: Record<string, unknown> }> {
  const caller = await requireUser()
  const { data, error } = await caller.db.from(table).select('*').eq('id', id).maybeSingle()
  // RLS means a non-member sees no row at all — that reads as not_found, which
  // is the correct answer: we must not confirm the row exists.
  if (error || !data) throw new ApiError('not_found', 'Not found.')
  const personId = data[column] as string
  const membership = await requireMember(personId)
  return { membership, row: data }
}

/** SYSTEM routes: shared-secret header check (API-CONTRACTS.md /api/cron/tick). */
export function requireCronSecret(req: Request) {
  const secret = process.env.CRON_SECRET
  const given = req.headers.get('x-cron-secret')
  if (!secret || !given || given !== secret) {
    throw new ApiError('unauthorized', 'Bad cron secret.')
  }
}
