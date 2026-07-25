import { NextResponse } from 'next/server'
import { route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { capsuleUrl } from '../route'

/**
 * GET /api/capsules/:personId — the manage list.
 *
 * The segment is named `id` because a sibling route uses a capsule id at the
 * same position, and Next requires one name per position. Here it is a person.
 */
export const GET = route(async (_req: Request, ctx: RouteContext<'/api/capsules/[id]'>) => {
  const { id: personId } = await ctx.params
  const member = await requireMember(personId)

  const { data: capsules } = await member.db
    .from('capsules')
    .select('id, kind, token, expires_at, revoked_at, created_at')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  const ids = (capsules ?? []).map((c) => c.id)
  const { data: views } = ids.length
    ? await member.db
        .from('capsule_views')
        .select('capsule_id, viewed_at')
        .in('capsule_id', ids)
        .order('viewed_at', { ascending: false })
    : { data: [] }

  const byCapsule = new Map<string, { viewedAt: string }[]>()
  for (const v of views ?? []) {
    const list = byCapsule.get(v.capsule_id as string) ?? []
    list.push({ viewedAt: v.viewed_at as string })
    byCapsule.set(v.capsule_id as string, list)
  }

  return NextResponse.json({
    capsules: (capsules ?? []).map((c) => ({
      id: c.id,
      kind: c.kind,
      url: capsuleUrl(c.token as string),
      expiresAt: c.expires_at,
      revokedAt: c.revoked_at,
      createdAt: c.created_at,
      views: byCapsule.get(c.id as string) ?? [],
    })),
  })
})
