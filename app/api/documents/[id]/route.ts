import { NextResponse } from 'next/server'
import { route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { findDuplicate } from '@/lib/ingest/dedupe'
import type { Narration } from '@/lib/ingest/schema'

/**
 * GET /api/documents/:id — polled by the live-narration processing card.
 *
 * Narration counts come from the facts actually written for this document, so
 * they are real rather than predicted. `duplicateOf` is computed here rather
 * than stored, which keeps the pipeline stateless.
 */
export const GET = route(async (_req: Request, ctx: RouteContext<'/api/documents/[id]'>) => {
  const { id } = await ctx.params
  const { membership, row } = await requireMemberOfRow('documents', id)
  const db = membership.db

  const tables = [
    ['medications', 'medications'],
    ['results', 'results'],
    ['open_loops', 'loops'],
    ['conditions', 'conditions'],
    ['allergies', 'allergies'],
    ['appointments', 'appointments'],
  ] as const

  const narration = {} as Narration
  for (const [table, key] of tables) {
    const { count } = await db
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('source_document_id', id)
    narration[key] = count ?? 0
  }

  let duplicateOf: string | undefined
  if (row.status === 'ready' && !row.merged_into) {
    const dup = await findDuplicate(db, row.person_id as string, {
      id,
      docDate: (row.doc_date as string) ?? null,
      sender: (row.sender as string) ?? null,
      docType: (row.doc_type as string) ?? null,
      transcript: (row.transcript as string) ?? '',
    })
    if (dup) duplicateOf = dup.documentId
  }

  return NextResponse.json({
    document: {
      id: row.id,
      personId: row.person_id,
      kind: row.kind,
      status: row.status,
      docType: row.doc_type,
      docDate: row.doc_date,
      sender: row.sender,
      transcript: row.transcript,
      mergedInto: row.merged_into,
      createdAt: row.created_at,
    },
    narration,
    ...(duplicateOf ? { duplicateOf } : {}),
  })
})
