import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { buildCapsule } from '@/lib/capsules/build'
import { walletPdf } from '@/lib/capsules/wallet'
import { capsuleUrl } from '../../route'
import type { CapsuleKind } from '@/lib/types'

/** GET /api/capsules/:id/wallet.pdf — the printable card (SPEC-FINAL §7). */
export const GET = route(async (_req: Request, ctx: RouteContext<'/api/capsules/[id]/wallet.pdf'>) => {
  const { id } = await ctx.params
  const { membership, row } = await requireMemberOfRow('capsules', id)

  if (row.kind !== 'paramedic') {
    throw new ApiError('invalid_input', 'Only the emergency card prints to a wallet card.')
  }
  if (row.revoked_at) throw new ApiError('revoked', 'That link was taken back.')

  const payload = await buildCapsule(membership.db, membership.personId, row.kind as CapsuleKind)
  const pdf = await walletPdf(payload, capsuleUrl(row.token as string))

  return new Response(pdf as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': 'inline; filename="emergency-card.pdf"',
      // The card contains someone's allergies; no cache should hold it.
      'cache-control': 'private, no-store',
    },
  })
})
