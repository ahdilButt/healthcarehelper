import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'

/**
 * POST /api/capsules/:id/revoke — kill a link.
 *
 * Anyone in the circle may revoke a link they made; only the owner may revoke
 * someone else's (SPEC-FINAL §2 permissions). Revoking is never undone — renew
 * makes a fresh window on a link that was only expired.
 */
export const POST = route(async (_req: Request, ctx: RouteContext<'/api/capsules/[id]/revoke'>) => {
  const { id } = await ctx.params
  const { membership, row } = await requireMemberOfRow('capsules', id)

  if (row.created_by !== membership.userId && membership.role !== 'owner') {
    throw new ApiError('forbidden', 'Only the owner can take back someone else’s link.')
  }

  const revokedAt = row.revoked_at ?? new Date().toISOString()
  const { error } = await membership.db
    .from('capsules')
    .update({ revoked_at: revokedAt })
    .eq('id', id)
  if (error) throw new ApiError('processing_failed', 'Could not take that link back.')

  return NextResponse.json({ revokedAt })
})
