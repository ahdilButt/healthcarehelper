import { NextResponse } from 'next/server'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireOwner } from '@/lib/api/guards'
import { urlToken } from '@/lib/api/tokens'

/**
 * POST /api/invites — owner mints the link Dad joins on his own phone.
 * Single-use, expiring, >=128-bit token (BUILD-GUIDE §4).
 */
export const POST = route(async (req: Request) => {
  const body = await readJson<{
    personId?: string
    role?: 'patient' | 'carer'
    expiresInHours?: number
  }>(req)
  const personId = required(body.personId, 'personId')
  const role = body.role ?? 'patient'
  if (role !== 'patient' && role !== 'carer') {
    throw new ApiError('invalid_input', 'role must be patient or carer.')
  }

  const owner = await requireOwner(personId)
  const hours = Math.min(Math.max(body.expiresInHours ?? 72, 1), 24 * 30)
  const token = urlToken()

  const { error } = await owner.db.from('invites').insert({
    token,
    person_id: personId,
    role,
    created_by: owner.userId,
    expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
  })
  if (error) throw new ApiError('processing_failed', 'Could not create the invite.')

  const base = process.env.APP_URL ?? 'http://localhost:3000'
  return NextResponse.json({ inviteUrl: `${base}/invite/${token}` })
})
