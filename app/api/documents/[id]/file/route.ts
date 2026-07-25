import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { signedUrlFor } from '@/lib/storage'
import { supabaseService } from '@/lib/supabase/service'

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
  const { row } = await requireMemberOfRow('documents', id)

  const path = row.storage_path as string
  if (!path || path === 'pending') throw new ApiError('not_found', 'That file is not ready yet.')

  const url = await signedUrlFor(supabaseService(), path)
  if (!url) throw new ApiError('not_found', 'Could not open that file.')

  return NextResponse.redirect(url, 302)
})
