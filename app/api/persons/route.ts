import { NextResponse } from 'next/server'
import { readJson, required, route } from '@/lib/api/errors'
import { requireUser } from '@/lib/api/guards'
import { ApiError } from '@/lib/api/errors'

/** POST /api/persons — creates the person plus the caller's owner membership. */
export const POST = route(async (req: Request) => {
  const caller = await requireUser()
  const body = await readJson<{ displayName?: string; managingNote?: string }>(req)
  const displayName = required(body.displayName?.trim(), 'displayName')

  const { data: person, error } = await caller.db
    .from('persons')
    .insert({
      display_name: displayName,
      managing_note: body.managingNote?.trim() || null,
      created_by: caller.userId,
    })
    .select('*')
    .single()
  if (error || !person) throw new ApiError('processing_failed', 'Could not create that person.')

  const { error: memErr } = await caller.db
    .from('memberships')
    .insert({ user_id: caller.userId, person_id: person.id, role: 'owner' })
  if (memErr) throw new ApiError('processing_failed', 'Could not set up access.')

  return NextResponse.json({ person })
})

/** GET /api/persons — the person switcher. */
export const GET = route(async () => {
  const caller = await requireUser()
  const { data, error } = await caller.db
    .from('memberships')
    .select('role, persons!inner(id, display_name)')
    .eq('user_id', caller.userId)
  if (error) throw new ApiError('processing_failed', 'Could not load your people.')

  const persons = (data ?? []).map((row) => {
    const p = row.persons as unknown as { id: string; display_name: string }
    return { id: p.id, displayName: p.display_name, role: row.role }
  })
  return NextResponse.json({ persons })
})
