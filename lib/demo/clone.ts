import { randomUUID } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * A private copy of the demo record, for someone who has just arrived.
 *
 * Guest mode's whole premise is that a stranger can upload a letter and talk
 * to it without an account — but an empty record has nothing to talk to, so
 * the first thing a guest needs is a record already full of letters. Copying
 * one is the honest way to do that: everyone gets their own, and what they
 * type, correct, tick off or delete is theirs alone. The alternative — one
 * shared login — means the third visitor sees the second visitor's mess and
 * the second visitor's Dad.
 *
 * Runs with the service role, and only ever from a route that has just
 * created the account it is copying to.
 */

/** The order matters: a table may only reference ids already remapped. */
const FACT_TABLES = [
  'conditions',
  'medications',
  'allergies',
  'results',
  'appointments',
  'open_loops',
] as const

type Row = Record<string, unknown>

/**
 * New ids are minted here rather than read back from the insert, so nothing
 * depends on rows coming back in the order they went in.
 */
function remapped(rows: Row[], edit: (row: Row, newId: string) => Row) {
  const ids = new Map<string, string>()
  const out: Row[] = []
  for (const row of rows) {
    const newId = randomUUID()
    ids.set(String(row.id), newId)
    // created_at is dropped so the copy is stamped when it was actually made;
    // every date the app displays comes from the letters, not from this.
    const rest = { ...row }
    delete rest.created_at
    out.push({ ...edit(rest, newId), id: newId })
  }
  return { ids, out }
}

async function insertAll(service: SupabaseClient, table: string, rows: Row[]) {
  if (!rows.length) return
  const { error } = await service.from(table).insert(rows)
  if (error) throw new Error(`clone ${table}: ${error.message}`)
}

async function readAll(service: SupabaseClient, table: string, personId: string): Promise<Row[]> {
  const { data, error } = await service.from(table).select('*').eq('person_id', personId)
  if (error) throw new Error(`read ${table}: ${error.message}`)
  return (data ?? []) as Row[]
}

export interface CloneResult {
  personId: string
  documents: number
  facts: number
}

export async function cloneRecord(
  service: SupabaseClient,
  opts: { templatePersonId: string; userId: string; displayName?: string }
): Promise<CloneResult> {
  const { data: template, error: personError } = await service
    .from('persons')
    .select('display_name, managing_note, emergency_contact, dnr_status')
    .eq('id', opts.templatePersonId)
    .single()
  if (personError || !template) throw new Error('the demo record to copy was not found')

  const personId = randomUUID()
  const { error: insertError } = await service.from('persons').insert({
    id: personId,
    display_name: opts.displayName ?? template.display_name,
    managing_note: template.managing_note,
    emergency_contact: template.emergency_contact,
    dnr_status: template.dnr_status,
    created_by: opts.userId,
  })
  if (insertError) throw new Error(`clone person: ${insertError.message}`)

  // Before anything else: a person with no membership is a record nobody can
  // see or delete, and the guest is the owner of their own copy.
  const { error: memberError } = await service
    .from('memberships')
    .insert({ user_id: opts.userId, person_id: personId, role: 'owner' })
  if (memberError) {
    await service.from('persons').delete().eq('id', personId)
    throw new Error(`clone membership: ${memberError.message}`)
  }

  // ---- documents. The storage_path is deliberately NOT copied to a new file:
  // originals are immutable, every read is a signed URL minted server-side
  // after a membership check, and the path was never the credential. Copying
  // twenty files per visitor would cost real seconds and real storage to
  // produce identical bytes.
  const docRows = await readAll(service, 'documents', opts.templatePersonId)
  const docs = remapped(docRows, (row) => ({
    ...row,
    person_id: personId,
    created_by: opts.userId,
    // Second pass — a merged document points at another document.
    merged_into: null,
  }))
  await insertAll(service, 'documents', docs.out)

  for (const row of docRows) {
    const target = row.merged_into ? docs.ids.get(String(row.merged_into)) : null
    if (!target) continue
    await service
      .from('documents')
      .update({ merged_into: target })
      .eq('id', docs.ids.get(String(row.id))!)
  }

  const factIds = new Map<string, Map<string, string>>()
  let facts = 0

  for (const table of FACT_TABLES) {
    const rows = await readAll(service, table, opts.templatePersonId)
    const cloned = remapped(rows, (row) => ({
      ...row,
      person_id: personId,
      source_document_id: docs.ids.get(String(row.source_document_id)) ?? null,
    }))
    // A fact whose letter did not come across would be a fact with no source,
    // which the whole product forbids. Drop it rather than orphan it.
    const keep = cloned.out.filter((r) => r.source_document_id)
    await insertAll(service, table, keep)
    factIds.set(table, cloned.ids)
    facts += keep.length
  }

  // ---- dose changes and routines both hang off a medication.
  const medIds = factIds.get('medications')!
  const changeRows = await readAll(service, 'med_change_events', opts.templatePersonId)
  const changes = remapped(changeRows, (row) => ({
    ...row,
    person_id: personId,
    medication_id: medIds.get(String(row.medication_id)) ?? null,
    source_document_id: docs.ids.get(String(row.source_document_id)) ?? null,
  }))
  await insertAll(
    service,
    'med_change_events',
    changes.out.filter((r) => r.medication_id && r.source_document_id)
  )
  factIds.set('med_change_events', changes.ids)

  const routineRows = await readAll(service, 'routines', opts.templatePersonId)
  const routines = remapped(routineRows, (row) => ({
    ...row,
    person_id: personId,
    medication_id: medIds.get(String(row.medication_id)) ?? null,
  }))
  await insertAll(service, 'routines', routines.out.filter((r) => r.medication_id))

  // ---- corrections. Skipping these would show the guest the raw AI reading of
  // a dose that a human has already fixed — the overlay IS the current value
  // (lib/facts/read.ts), so it travels with the facts or the copy is wrong.
  const correctionRows = await readAll(service, 'corrections', opts.templatePersonId)
  const corrections = remapped(correctionRows, (row) => ({
    ...row,
    person_id: personId,
    fact_id: factIds.get(String(row.fact_table))?.get(String(row.fact_id)) ?? null,
    corrected_by: opts.userId,
  }))
  await insertAll(service, 'corrections', corrections.out.filter((r) => r.fact_id))

  // Taken events, conversations, capsules and invites are deliberately left
  // behind. The guest's day starts unticked, their questions are their own,
  // and a copied capsule token would be a live link to somebody else's copy.

  return { personId, documents: docs.out.length, facts }
}

/**
 * Which record gets copied. An explicit id in the environment wins; otherwise
 * the oldest "Dad", matching the seed script's rule that oldest wins so a
 * re-run never invents a second one.
 */
export async function templatePersonId(service: SupabaseClient): Promise<string | null> {
  const configured = process.env.DEMO_TEMPLATE_PERSON_ID?.trim()
  if (configured) return configured

  const { data } = await service
    .from('persons')
    .select('id')
    .eq('display_name', 'Dad')
    .order('created_at', { ascending: true })
    .limit(1)
  return data?.[0]?.id ?? null
}
