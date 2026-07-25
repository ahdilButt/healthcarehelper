import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { isFactTable } from '@/lib/types'

/**
 * POST /api/facts/:table/:id/confirm — "yes, that is what it says".
 *
 * This clears the amber and nothing else. It deliberately does NOT move the
 * live medication dose: write-facts.ts refuses to let an unconfirmed reading
 * rewrite `medications.current_dose` precisely so a blurred box can never
 * become a treatment change, and a one-tap confirm must not be the back door
 * into the same thing (SPEC-FINAL §3). Someone who wants the live dose changed
 * fixes it explicitly, in words, through /correct.
 */
export const POST = route(async (_req: Request, ctx: RouteContext<'/api/facts/[table]/[id]/confirm'>) => {
  const { table, id } = await ctx.params
  if (!isFactTable(table)) throw new ApiError('not_found', 'Not found.')

  const { membership } = await requireMemberOfRow(table, id)

  const { data, error } = await membership.db
    .from(table)
    .update({ confirmed_at: new Date().toISOString() })
    .eq('id', id)
    .select('confirmed_at')
    .single()
  if (error || !data) throw new ApiError('processing_failed', 'Could not save that.')

  return NextResponse.json({ confirmedAt: data.confirmed_at })
})
