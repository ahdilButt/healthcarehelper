import { NextResponse } from 'next/server'
import { route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { buildBrief } from '@/lib/routines/brief'

/**
 * GET /api/today/:personId/brief — the line at the top of Today.
 *
 * Separate from the Today payload on purpose: the list must paint instantly,
 * and this waits on a Claude call. The screen is usable before the sentence
 * arrives, and remains usable if it never does.
 */
export const GET = route(async (_req: Request, ctx: RouteContext<'/api/today/[personId]/brief'>) => {
  const { personId } = await ctx.params
  const member = await requireMember(personId)

  const { data: person } = await member.db
    .from('persons')
    .select('display_name')
    .eq('id', personId)
    .maybeSingle()

  const brief = await buildBrief(member.db, personId, person?.display_name ?? 'They')
  return NextResponse.json(brief)
})
