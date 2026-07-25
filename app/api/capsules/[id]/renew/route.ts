import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { CAPSULE_EXPIRY_HOURS } from '@/lib/constants'

/**
 * POST /api/capsules/:id/renew — another window on the same link.
 *
 * A revoked link is never renewed. Revoking is the deliberate act of taking
 * something back, and quietly reviving it would make that act untrustworthy;
 * making a new link is one tap away.
 */
export const POST = route(async (_req: Request, ctx: RouteContext<'/api/capsules/[id]/renew'>) => {
  const { id } = await ctx.params
  const { membership, row } = await requireMemberOfRow('capsules', id)

  if (row.revoked_at) {
    throw new ApiError('revoked', 'That link was taken back. Make a new one instead.')
  }

  const hours = CAPSULE_EXPIRY_HOURS[row.kind as string]
  const expiresAt = hours === null ? null : new Date(Date.now() + hours * 3600 * 1000).toISOString()

  const { error } = await membership.db
    .from('capsules')
    .update({ expires_at: expiresAt })
    .eq('id', id)
  if (error) throw new ApiError('processing_failed', 'Could not renew that link.')

  return NextResponse.json({ expiresAt })
})
