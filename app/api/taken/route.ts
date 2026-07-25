import { NextResponse } from 'next/server'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { nextSite } from '@/lib/routines/today'

/**
 * POST /api/taken — the one tap on a Today row.
 *
 * It toggles, because the tap it undoes is a mis-tap on a phone in a coat
 * pocket, and a record of a dose that was not taken is worse than no record.
 * Patch rows carry their site, which is what makes the body map true rather
 * than decorative (SPEC-FINAL §6, decision C3).
 */
export const POST = route(async (req: Request) => {
  const body = await readJson<{ routineId?: string; dueAt?: string; site?: string; taken?: boolean }>(req)
  const routineId = String(required(body.routineId, 'routineId'))
  const dueAtRaw = String(required(body.dueAt, 'dueAt'))

  const dueAt = new Date(dueAtRaw)
  if (Number.isNaN(dueAt.getTime())) throw new ApiError('invalid_input', 'That time was not understood.')

  const { membership, row: routine } = await requireMemberOfRow('routines', routineId)
  const db = membership.db
  const dueIso = dueAt.toISOString()

  const { data: existing } = await db
    .from('taken_events')
    .select('id, taken_at, site')
    .eq('routine_id', routineId)
    .eq('due_at', dueIso)
    .maybeSingle()

  const wantTaken = body.taken ?? !existing?.taken_at

  if (!wantTaken) {
    if (existing) await db.from('taken_events').delete().eq('id', existing.id)
    return NextResponse.json({ takenEvent: null, taken: false })
  }

  const { data: med } = await db
    .from('medications')
    .select('rotation_sites')
    .eq('id', routine.medication_id as string)
    .maybeSingle()
  const sites = ((med?.rotation_sites as string[] | null) ?? []).filter(Boolean)

  let site: string | null = null
  if (sites.length) {
    const { data: last } = await db
      .from('taken_events')
      .select('site')
      .eq('routine_id', routineId)
      .not('site', 'is', null)
      .order('due_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const asked = body.site?.trim()
    if (asked && !sites.includes(asked)) {
      throw new ApiError('invalid_input', 'That is not one of the sites for this one.')
    }
    site = asked ?? nextSite(sites, (last?.site as string | null) ?? null)
  }

  const values = {
    person_id: membership.personId,
    routine_id: routineId,
    due_at: dueIso,
    taken_at: new Date().toISOString(),
    site,
    marked_by: membership.userId,
  }

  const { data, error } = existing
    ? await db.from('taken_events').update(values).eq('id', existing.id).select('*').single()
    : await db.from('taken_events').insert(values).select('*').single()
  if (error || !data) throw new ApiError('processing_failed', 'Could not save that.')

  return NextResponse.json({
    takenEvent: data,
    taken: true,
    ...(site ? { nextSite: nextSite(sites, site) } : {}),
  })
})
