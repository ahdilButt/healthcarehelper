import { NextResponse } from 'next/server'
import { route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { buildTimeline } from '@/lib/timeline/build'

/** GET /api/persons/:id/timeline — the merged feed (API-CONTRACTS.md). */
export const GET = route(async (req: Request, ctx: RouteContext<'/api/persons/[id]/timeline'>) => {
  const { id } = await ctx.params
  const member = await requireMember(id)

  const url = new URL(req.url)
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 30) || 30, 100)
  const cursor = url.searchParams.get('cursor')

  // Cursor is the date of the last item seen; the feed is date-descending.
  const all = await buildTimeline(member.db, id, 500)
  const start = cursor ? all.findIndex((i) => i.id === cursor) + 1 : 0
  const items = all.slice(start, start + limit)
  const nextCursor = start + limit < all.length ? items[items.length - 1]?.id : undefined

  return NextResponse.json({ items, ...(nextCursor ? { nextCursor } : {}) })
})
