import { NextResponse } from 'next/server'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { CORRECTABLE_FIELDS, normaliseCorrection, ruleFor } from '@/lib/facts/read'
import { isFactTable } from '@/lib/types'

const MAX_LENGTH = 500

/**
 * POST /api/facts/:table/:id/correct — "Fix this".
 *
 * The correction is an overlay, never an edit (SPEC-FINAL §3): the reading the
 * machine made stays on the record beside the human's words, so the two can
 * always be compared and a mistaken fix can be made again rather than lost.
 */
export const POST = route(async (req: Request, ctx: RouteContext<'/api/facts/[table]/[id]/correct'>) => {
  const { table, id } = await ctx.params
  // Validated before it can reach .from() — a path segment is not a table name.
  if (!isFactTable(table)) throw new ApiError('not_found', 'Not found.')

  const body = await readJson<{ field?: string; value?: string }>(req)
  const field = String(required(body.field, 'field'))
  if (!CORRECTABLE_FIELDS[table].includes(field)) {
    throw new ApiError('invalid_input', 'That part cannot be fixed here.')
  }

  const typed = String(required(body.value, 'value')).trim()
  if (!typed) throw new ApiError('invalid_input', 'Type what it should say.')
  if (typed.length > MAX_LENGTH) throw new ApiError('invalid_input', 'That is a little too long.')

  // Refuse what the rest of the app cannot read, rather than storing a fix the
  // timeline would silently ignore while the sheet claimed it had taken.
  const value = normaliseCorrection(table, field, typed)
  if (value === null) throw new ApiError('invalid_input', ruleFor(table, field).hint)

  const { membership, row } = await requireMemberOfRow(table, id)

  const { data, error } = await membership.db
    .from('corrections')
    .insert({
      person_id: membership.personId,
      fact_table: table,
      fact_id: id,
      field,
      corrected_value: value,
      corrected_by: membership.userId,
    })
    .select('id, field, corrected_value, created_at')
    .single()
  if (error || !data) throw new ApiError('processing_failed', 'Could not save that fix.')

  // Someone typing the value IS the human check the amber badge was asking for,
  // so a fixed fact stops being unconfirmed. Without this the value she typed
  // herself would be the one thing kept out of the doctor brief.
  if (!row.confirmed_at) {
    await membership.db
      .from(table)
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', id)
  }

  return NextResponse.json({
    correction: { id: data.id, field: data.field, value: data.corrected_value, at: data.created_at },
  })
})
