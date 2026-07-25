import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { DOCUMENTS_BUCKET, SIGNED_URL_TTL_SECONDS } from '@/lib/constants'

/**
 * GET /api/documents/:id/file — "view the original letter", the citation made
 * physical.
 *
 * The bucket is private. This redirects to a short-lived signed URL minted
 * only after the membership check, so an original is never reachable by
 * guessing a path (BUILD-GUIDE §4).
 */
export const GET = route(async (_req: Request, ctx: RouteContext<'/api/documents/[id]/file'>) => {
  const { id } = await ctx.params
  const { membership, row } = await requireMemberOfRow('documents', id)

  const path = row.storage_path as string
  if (!path || path === 'pending') throw new ApiError('not_found', 'That file is not ready yet.')

  const { data, error } = await membership.db.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  if (error || !data) throw new ApiError('not_found', 'Could not open that file.')

  return NextResponse.redirect(data.signedUrl, 302)
})
