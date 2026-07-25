import { NextResponse } from 'next/server'
import { readJson, required, route } from '@/lib/api/errors'
import { requireUser } from '@/lib/api/guards'
import { ApiError } from '@/lib/api/errors'
import { supabaseService } from '@/lib/supabase/service'

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

  // `memberships` has a select policy and nothing else — the frozen schema says
  // so in as many words ("inserts happen server-side (invite accept / person
  // create)"), because a row here is what grants access to a record and no
  // client should be able to write one. This is that named path: the person
  // above was already authorised by RLS, and the caller can only ever make
  // themselves the owner of what they just created.
  const { error: memErr } = await supabaseService()
    .from('memberships')
    .insert({ user_id: caller.userId, person_id: person.id, role: 'owner' })

  if (memErr) {
    // Otherwise a failure here leaves a person nobody can see or delete.
    await supabaseService().from('persons').delete().eq('id', person.id)
    console.error('[persons] membership insert failed', memErr.message)
    throw new ApiError('processing_failed', 'Could not set up access.')
  }

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
