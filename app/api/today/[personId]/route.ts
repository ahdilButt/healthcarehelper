import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { ensureRoutines } from '@/lib/routines/schedule'
import { buildToday } from '@/lib/routines/today'
import { londonDate } from '@/lib/routines/time'

/** GET /api/today/:personId — the daily layer (API-CONTRACTS.md). */
export const GET = route(async (req: Request, ctx: RouteContext<'/api/today/[personId]'>) => {
  const { personId } = await ctx.params
  const member = await requireMember(personId)

  const asked = new URL(req.url).searchParams.get('date')
  if (asked && !/^\d{4}-\d{2}-\d{2}$/.test(asked)) {
    throw new ApiError('invalid_input', 'Dates look like 2026-07-25.')
  }

  await ensureRoutines(member.db, personId)
  const today = await buildToday(member.db, personId, asked ?? londonDate())

  return NextResponse.json(today)
})
