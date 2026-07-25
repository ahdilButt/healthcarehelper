import { NextResponse } from 'next/server'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireUser } from '@/lib/api/guards'
import { supabaseService } from '@/lib/supabase/service'

/**
 * POST /api/invites/accept — the caller must already be signed in; the token
 * only decides WHICH record they join.
 *
 * Service-role is used deliberately: the invitee is not yet a member, so RLS
 * would hide both the invite row and the membership insert. The token is
 * validated (exists, unexpired, unused) before the elevated client is touched,
 * which is the pattern API-CONTRACTS.md marks SYSTEM.
 */
export const POST = route(async (req: Request) => {
  const caller = await requireUser()
  const body = await readJson<{ token?: string }>(req)
  const token = required(body.token, 'token')

  const svc = supabaseService()
  const { data: invite } = await svc
    .from('invites')
    .select('token, person_id, role, expires_at, used_by')
    .eq('token', token)
    .maybeSingle()

  if (!invite) throw new ApiError('not_found', 'That invite link is not valid.')
  if (invite.used_by) throw new ApiError('expired', 'That invite link has already been used.')
  if (new Date(invite.expires_at) < new Date()) {
    throw new ApiError('expired', 'That invite link has expired. Ask for a new one.')
  }

  // Already a member (e.g. they tapped the link twice) — succeed quietly.
  const { data: existing } = await svc
    .from('memberships')
    .select('role')
    .eq('person_id', invite.person_id)
    .eq('user_id', caller.userId)
    .maybeSingle()

  if (!existing) {
    const { error } = await svc
      .from('memberships')
      .insert({ user_id: caller.userId, person_id: invite.person_id, role: invite.role })
    if (error) throw new ApiError('processing_failed', 'Could not join that record.')
  }

  await svc
    .from('invites')
    .update({ used_by: caller.userId, used_at: new Date().toISOString() })
    .eq('token', token)

  return NextResponse.json({ personId: invite.person_id, role: invite.role })
})
