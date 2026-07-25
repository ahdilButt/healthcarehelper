import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyCorrections,
  correctionsForPerson,
  displayValueOf,
  factKey,
  humanTitleOf,
  isConfirmed,
  type FactRow,
} from '@/lib/facts/read'
import { sourceLabel } from '@/lib/timeline/build'
import { FACT_TABLES, type Citation, type FactTable } from '@/lib/types'

/**
 * The record, written out for Claude to read (SPEC-FINAL §5).
 *
 * Two rules shape this file. Everything carries a reference — [F12], [D3] —
 * because an answer that cannot cite its source may not be said at all, and
 * letting the model invent an id is how a citation ends up pointing at nothing.
 * And every fact goes through the correction overlay first, so the record the
 * answer reasons about is the one the family has corrected, not the raw reading.
 */

export interface RecordContext {
  catalogue: string
  /** Reference -> the citation the API returns. Anything not in here is dropped. */
  refs: Map<string, Citation>
  documents: number
  facts: number
}

/** Long enough for any of the demo letters; a guard, not a summariser. */
const MAX_TRANSCRIPT = 12000

interface DocRow {
  id: string
  doc_type: string | null
  doc_date: string | null
  sender: string | null
  transcript: string | null
  status: string
  merged_into: string | null
  created_at: string
}

const TABLE_HEADING: Record<FactTable, string> = {
  conditions: 'What he lives with',
  medications: 'His medicines',
  med_change_events: 'Changes to his medicines',
  allergies: 'Allergies',
  results: 'Test results',
  appointments: 'Appointments',
  open_loops: 'Things still in the air',
}

export async function buildRecordContext(
  db: SupabaseClient,
  personId: string,
  personName: string
): Promise<RecordContext> {
  const [docsRes, corrections, ...factRes] = await Promise.all([
    db
      .from('documents')
      .select('id, doc_type, doc_date, sender, transcript, status, merged_into, created_at')
      .eq('person_id', personId)
      .order('doc_date', { ascending: true, nullsFirst: false }),
    correctionsForPerson(db, personId),
    ...FACT_TABLES.map((t) => db.from(t).select('*').eq('person_id', personId)),
  ])

  const docs = ((docsRes.data ?? []) as DocRow[]).filter(
    (d) => d.status === 'ready' && (!d.merged_into || d.merged_into === d.id)
  )

  const refs = new Map<string, Citation>()
  const docRef = new Map<string, string>()
  const lines: string[] = []

  lines.push(`# ${personName}'s record`)
  lines.push(
    `Everything below came out of the letters ${personName} has been sent. Nothing else is known.`
  )

  // ---- the facts, table by table, in the words the app shows them in
  let factCount = 0
  const factLines: string[] = []
  docs.forEach((d, i) => docRef.set(d.id, `D${i + 1}`))

  FACT_TABLES.forEach((table, tableIndex) => {
    const rows = (factRes[tableIndex]?.data ?? []) as FactRow[]
    const visible = rows.filter((r) => docRef.has(String(r.source_document_id)))
    if (!visible.length) return

    factLines.push(``, `## ${TABLE_HEADING[table]}`)
    for (const raw of visible) {
      const id = String(raw.id)
      const documentId = String(raw.source_document_id)
      const row = applyCorrections(raw, corrections.get(factKey(table, id)))
      const ref = `F${++factCount}`

      const confirmed = isConfirmed(
        Number(raw.confidence ?? 0),
        (raw.confirmed_at as string | null) ?? null
      )
      const edited = corrections.has(factKey(table, id))
      const notes = [
        `source ${docRef.get(documentId)}`,
        confirmed ? null : 'UNCONFIRMED — say so if you lean on it',
        edited ? 'corrected by the family' : null,
      ].filter(Boolean)

      factLines.push(
        `- [${ref}] ${humanTitleOf(table, row)}: ${displayValueOf(table, row)} (${notes.join('; ')})`
      )

      refs.set(ref, {
        factTable: table,
        factId: id,
        documentId,
        label: sourceLabel(docs.find((d) => d.id === documentId)),
      })
    }
  })

  lines.push(...factLines)

  // ---- the letters themselves: an answer is only ever as good as the words
  lines.push(``, `# The letters`)
  for (const d of docs) {
    const ref = docRef.get(d.id) as string
    refs.set(ref, {
      factTable: 'documents',
      factId: d.id,
      documentId: d.id,
      label: sourceLabel(d),
    })
    const transcript = (d.transcript ?? '').trim().slice(0, MAX_TRANSCRIPT)
    lines.push(
      ``,
      `## [${ref}] ${sourceLabel(d)}${d.sender ? ` — ${d.sender}` : ''}`,
      transcript || '(no readable text)'
    )
  }

  return { catalogue: lines.join('\n'), refs, documents: docs.length, facts: factCount }
}
