import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import {
  applyCorrections,
  displayValueOf,
  fieldsFor,
  humanTitleOf,
  isConfirmed,
  latestCorrections,
  latestOf,
  listCorrections,
  locatorsFor,
  transcriptExcerpt,
} from '@/lib/facts/read'
import type { FactRow } from '@/lib/facts/read'
import { isFactTable } from '@/lib/types'
import type { FactDetail } from '@/lib/types'

/**
 * GET /api/facts/:table/:id — the detail sheet: the full reading, what a human
 * has fixed, and the passage of the letter it came from.
 */
export const GET = route(async (_req: Request, ctx: RouteContext<'/api/facts/[table]/[id]'>) => {
  const { table, id } = await ctx.params
  // An unvalidated path segment reaching .from() is an injection surface, so
  // this runs before anything touches the database.
  if (!isFactTable(table)) throw new ApiError('not_found', 'Not found.')

  const { membership, row } = await requireMemberOfRow(table, id)
  const db = membership.db

  const corrections = await listCorrections(db, table, id)
  const latest = latestOf(corrections)
  const corrected = applyCorrections(row, latest)

  let medicationName: string | null = null
  if (table === 'med_change_events') {
    const medicationId = String(row.medication_id ?? '')
    const { data: med } = await db.from('medications').select('id, name').eq('id', medicationId).maybeSingle()
    if (med) {
      const fixes = await latestCorrections(db, 'medications', medicationId)
      const name = applyCorrections(med as FactRow, fixes).name
      medicationName = typeof name === 'string' ? name : null
    }
  }

  const sourceDocumentId = String(row.source_document_id)
  const { data: doc } = await db
    .from('documents')
    .select('id, transcript')
    .eq('id', sourceDocumentId)
    .maybeSingle()

  const confidence = Number(row.confidence ?? 0)
  const confirmedAt = (row.confirmed_at as string | null) ?? null
  // Located against the original row: the page holds what was read.
  const excerpt = transcriptExcerpt(
    (doc?.transcript as string | null) ?? null,
    locatorsFor(table, row)
  )

  const body: FactDetail = {
    fact: {
      table,
      id: String(row.id),
      personId: String(row.person_id),
      sourceDocumentId,
      humanTitle: humanTitleOf(table, corrected, { medicationName }),
      confidence,
      confirmed: isConfirmed(confidence, confirmedAt),
      confirmedAt,
      fields: fieldsFor(table, row, latest),
    },
    corrections,
    displayValue: displayValueOf(table, corrected),
    edited: corrections.length > 0,
    document: {
      id: sourceDocumentId,
      transcriptExcerpt: excerpt.text,
      excerptLocated: excerpt.located,
    },
  }

  return NextResponse.json(body)
})
