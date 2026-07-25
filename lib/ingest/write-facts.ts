import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExtractedFacts } from './schema'
import { CONFIRMED_THRESHOLD } from '@/lib/constants'
import { doseChanged, richerDose, sameMedicine } from './medications'

/**
 * Persists one document's extracted facts.
 *
 * The ONLY path that writes fact rows — used by both the live pipeline and the
 * seed script, so seeded and ingested records are indistinguishable downstream.
 *
 * Medication handling is the subtle part: a letter that restates an existing
 * medicine must not create a duplicate row, and a letter that changes a dose
 * must produce a med_change_event pointing at the letter that did it.
 */
export interface WriteResult {
  counts: Record<string, number>
  medChangeEvents: { medicationId: string; name: string; oldDose: string | null; newDose: string }[]
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

export async function writeFacts(
  db: SupabaseClient,
  personId: string,
  documentId: string,
  facts: ExtractedFacts
): Promise<WriteResult> {
  const counts: Record<string, number> = {}
  const medChangeEvents: WriteResult['medChangeEvents'] = []
  const base = { person_id: personId, source_document_id: documentId }

  if (facts.conditions.length) {
    const { data: existing } = await db.from('conditions').select('id,name').eq('person_id', personId)
    const seen = new Set((existing ?? []).map((c) => norm(c.name)))
    const fresh = facts.conditions.filter((c) => !seen.has(norm(c.name)))
    if (fresh.length) {
      const { error } = await db.from('conditions').insert(
        fresh.map((c) => ({ ...base, name: c.name, status: c.status, confidence: c.confidence }))
      )
      if (error) throw new Error(`conditions: ${error.message}`)
    }
    counts.conditions = fresh.length
  }

  if (facts.allergies.length) {
    const { data: existing } = await db.from('allergies').select('id,substance').eq('person_id', personId)
    const seen = new Set((existing ?? []).map((a) => norm(a.substance)))
    const fresh = facts.allergies.filter((a) => !seen.has(norm(a.substance)))
    if (fresh.length) {
      const { error } = await db.from('allergies').insert(
        fresh.map((a) => ({ ...base, substance: a.substance, reaction: a.reaction, confidence: a.confidence }))
      )
      if (error) throw new Error(`allergies: ${error.message}`)
    }
    counts.allergies = fresh.length
  }

  if (facts.medications.length) {
    const { data: existingMeds } = await db
      .from('medications')
      .select('id,name,current_dose,is_active')
      .eq('person_id', personId)
    const known: { id: string; name: string; current_dose: string; is_active: boolean }[] = [
      ...(existingMeds ?? []),
    ]

    for (const m of facts.medications) {
      const prior = known.find((k) => sameMedicine(k.name, m.name))

      if (!prior) {
        const { data, error } = await db
          .from('medications')
          .insert({
            ...base,
            name: m.name,
            current_dose: m.current_dose,
            form: m.form,
            schedule_hint: m.schedule_hint,
            rotation_sites: m.rotation_sites,
            is_active: m.is_active,
            confidence: m.confidence,
          })
          .select('id')
          .single()
        if (error) throw new Error(`medications insert: ${error.message}`)
        counts.medications = (counts.medications ?? 0) + 1
        known.push({ id: data.id, name: m.name, current_dose: m.current_dose, is_active: m.is_active })

        // A medicine introduced *with* a stated previous dose is still a change.
        if (m.change) {
          await insertChange(db, personId, documentId, data.id, m.change.old_dose, m.current_dose, facts.doc_meta.date, m.confidence)
          medChangeEvents.push({ medicationId: data.id, name: m.name, oldDose: m.change.old_dose, newDose: m.current_dose })
          counts.med_change_events = (counts.med_change_events ?? 0) + 1
        }
        continue
      }

      // Known medicine. Update the live dose / active flag, and record the
      // change event when the dose actually moved.
      //
      // PRODUCT LAW (SPEC-FINAL §3): an unconfirmed reading must never rewrite
      // the live dose or fire a what-changed alert. A blurred box or an
      // ambiguous biro annotation ("taking 2 in AM some days?") is a question
      // for a clinician, not a dose change — the extractor raises it as an
      // open loop instead. The fact row still exists on the document, amber.
      const confident = m.confidence >= CONFIRMED_THRESHOLD
      const doseMoved = confident && doseChanged(prior.current_dose, m.current_dose)
      const stopped = confident && prior.is_active && !m.is_active

      if (doseMoved || stopped || m.rotation_sites || m.schedule_hint) {
        const patch: Record<string, unknown> = {}
        // Unchanged strength: keep the fuller wording. A clinic letter's
        // "5mg once daily" must not be flattened by a repeat slip's "5mg".
        const merged = confident ? richerDose(prior.current_dose, m.current_dose) : prior.current_dose
        if (merged !== prior.current_dose) patch.current_dose = merged
        if (confident && prior.is_active !== m.is_active) patch.is_active = m.is_active
        if (m.rotation_sites) patch.rotation_sites = m.rotation_sites
        if (m.schedule_hint) patch.schedule_hint = m.schedule_hint
        if (Object.keys(patch).length) {
          const { error } = await db.from('medications').update(patch).eq('id', prior.id)
          if (error) throw new Error(`medications update: ${error.message}`)
        }
      }

      if (doseMoved) {
        const oldDose = m.change?.old_dose ?? prior.current_dose
        await insertChange(db, personId, documentId, prior.id, oldDose, m.current_dose, facts.doc_meta.date, m.confidence)
        medChangeEvents.push({ medicationId: prior.id, name: m.name, oldDose, newDose: m.current_dose })
        counts.med_change_events = (counts.med_change_events ?? 0) + 1
      }
    }
  }

  if (facts.results.length) {
    const { error } = await db.from('results').insert(
      facts.results.map((r) => ({
        ...base,
        name: r.name,
        value: r.value,
        value_text: r.value_text,
        unit: r.unit,
        ref_low: r.ref_low,
        ref_high: r.ref_high,
        flagged: r.flagged,
        result_date: r.result_date ?? facts.doc_meta.date,
        confidence: r.confidence,
      }))
    )
    if (error) throw new Error(`results: ${error.message}`)
    counts.results = facts.results.length
  }

  if (facts.appointments.length) {
    const { error } = await db.from('appointments').insert(
      facts.appointments.map((a) => ({
        ...base,
        title: a.title,
        location: a.location,
        starts_at: a.starts_at,
        confidence: a.confidence,
      }))
    )
    if (error) throw new Error(`appointments: ${error.message}`)
    counts.appointments = facts.appointments.length
  }

  if (facts.open_loops.length) {
    const { error } = await db.from('open_loops').insert(
      facts.open_loops.map((l) => ({
        ...base,
        loop_type: l.loop_type,
        description: l.description,
        expected_date: l.expected_date,
        state: 'waiting',
        confidence: l.confidence,
      }))
    )
    if (error) throw new Error(`open_loops: ${error.message}`)
    counts.open_loops = facts.open_loops.length
  }

  return { counts, medChangeEvents }
}

async function insertChange(
  db: SupabaseClient,
  personId: string,
  documentId: string,
  medicationId: string,
  oldDose: string | null,
  newDose: string,
  changedOn: string | null,
  confidence: number
) {
  const { error } = await db.from('med_change_events').insert({
    person_id: personId,
    medication_id: medicationId,
    old_dose: oldDose,
    new_dose: newDose,
    changed_on: changedOn,
    source_document_id: documentId,
    confidence,
  })
  if (error) throw new Error(`med_change_events: ${error.message}`)
}
