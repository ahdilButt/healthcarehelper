import { NextResponse } from 'next/server'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'

const FACT_TABLES = [
  'conditions',
  'medications',
  'med_change_events',
  'allergies',
  'results',
  'appointments',
  'open_loops',
] as const

/**
 * POST /api/documents/:id/merge — the answer to the gentle merge prompt.
 *
 * merge: this document is the same letter as `duplicateOfId`. It becomes a
 *   second photograph of that letter — status 'merged', pointed at the winner,
 *   and its duplicate facts are suppressed so the timeline shows one entry.
 *   The original file stays in storage: "merged doc keeps both photos".
 *
 * keep: they really are different documents. We record that decision by
 *   pointing merged_into at the document itself — a self-reference is
 *   meaningless otherwise, and it means we stop asking without needing a
 *   column the frozen schema doesn't have.
 */
export const POST = route(async (req: Request, ctx: RouteContext<'/api/documents/[id]/merge'>) => {
  const { id } = await ctx.params
  const body = await readJson<{ action?: 'merge' | 'keep'; duplicateOfId?: string }>(req)
  const action = required(body.action, 'action')
  if (action !== 'merge' && action !== 'keep') {
    throw new ApiError('invalid_input', 'action must be merge or keep.')
  }

  const { membership } = await requireMemberOfRow('documents', id)
  const db = membership.db

  if (action === 'keep') {
    const { error } = await db.from('documents').update({ merged_into: id }).eq('id', id)
    if (error) throw new ApiError('processing_failed', 'Could not save that choice.')
    return NextResponse.json({ status: 'kept' })
  }

  const duplicateOfId = required(body.duplicateOfId, 'duplicateOfId')
  // The winner must belong to the same person — never merge across records.
  const { data: winner } = await db
    .from('documents')
    .select('id, person_id')
    .eq('id', duplicateOfId)
    .maybeSingle()
  if (!winner || winner.person_id !== membership.personId) {
    throw new ApiError('not_found', 'That document was not found.')
  }

  for (const table of FACT_TABLES) {
    const { error } = await db.from(table).delete().eq('source_document_id', id)
    if (error) throw new ApiError('processing_failed', `Could not merge (${table}).`)
  }

  const { error } = await db
    .from('documents')
    .update({ status: 'merged', merged_into: duplicateOfId })
    .eq('id', id)
  if (error) throw new ApiError('processing_failed', 'Could not merge those documents.')

  return NextResponse.json({ status: 'merged' })
})
