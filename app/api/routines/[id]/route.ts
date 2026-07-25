import { NextResponse } from 'next/server'
import { ApiError, readJson, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { isValidTime } from '@/lib/routines/time'

/** PATCH /api/routines/:id — hand-editable always (SPEC-FINAL §6). */
export const PATCH = route(async (req: Request, ctx: RouteContext<'/api/routines/[id]'>) => {
  const { id } = await ctx.params
  const body = await readJson<{ times?: string[]; enabled?: boolean }>(req)

  const patch: { times?: string[]; enabled?: boolean } = {}

  if (body.times !== undefined) {
    if (!Array.isArray(body.times) || !body.times.length) {
      throw new ApiError('invalid_input', 'Choose at least one time of day.')
    }
    if (!body.times.every(isValidTime)) {
      throw new ApiError('invalid_input', 'Times look like 08:00.')
    }
    patch.times = [...new Set(body.times)].sort()
  }
  if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled)
  if (!Object.keys(patch).length) throw new ApiError('invalid_input', 'Nothing to change.')

  const { membership } = await requireMemberOfRow('routines', id)

  const { data, error } = await membership.db
    .from('routines')
    .update(patch)
    .eq('id', id)
    .select('id, medication_id, times, enabled')
    .single()
  if (error || !data) throw new ApiError('processing_failed', 'Could not save that.')

  return NextResponse.json({ routine: data })
})
