import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCorrections, correctionsForPerson, factKey } from '@/lib/facts/read'
import type { MedForm } from '@/lib/types'

/**
 * Schedules built from the letters, editable by hand (SPEC-FINAL §6).
 *
 * A family that has just photographed a shoebox should not then have to type
 * their father's medicine round into a form. The letters already say "twice
 * daily", "at night", "each morning" — so the first schedule comes from the
 * words the prescriber used, and the edit button exists for everything the
 * words did not cover.
 */

export interface MedicationRow {
  id: string
  name: string
  current_dose: string
  form: MedForm
  schedule_hint: string | null
  rotation_sites: string[] | null
  is_active: boolean
}

const MORNING = '08:00'
const MIDDAY = '13:00'
const EVENING = '20:00'
const BEDTIME = '21:30'

/**
 * The dose line and the schedule hint both carry timing, and the prescriber's
 * shorthand is part of the language: bd is twice a day, nocte is at night.
 */
export function defaultTimes(med: {
  current_dose: string
  schedule_hint: string | null
  form: MedForm
}): string[] {
  const said = `${med.current_dose} ${med.schedule_hint ?? ''}`.toLowerCase()

  // The patch is decided before any of the words, because its instructions say
  // both "each morning" and "off at night" — the night half is when it comes
  // off, and a reminder at half past nine to put on this morning's patch is
  // worse than no reminder at all.
  if (med.form === 'patch') return [MORNING]

  if (/\b(four times|qds|qid)\b/.test(said)) return [MORNING, MIDDAY, '17:00', EVENING]
  if (/\b(three times|tds|tid|8[- ]hourly)\b/.test(said)) return [MORNING, MIDDAY, EVENING]
  if (/\b(twice|two times|bd|bid|12[- ]hourly|morning and (evening|night))\b/.test(said)) {
    return [MORNING, EVENING]
  }
  // "each night" and "at night" are the same instruction; so is "nocte".
  if (/\b(night|nocte|bedtime|evening)\b/.test(said)) return [BEDTIME]
  if (/\b(lunch|midday|noon)\b/.test(said)) return [MIDDAY]

  return [MORNING]
}

/**
 * Give every active medicine a schedule, once.
 *
 * Called on the way into Today rather than at ingest: a medicine can arrive
 * from any of three doors, and this way none of them has to remember to do it.
 * Existing routines are never touched — an edit must survive the next letter.
 */
export async function ensureRoutines(
  db: SupabaseClient,
  personId: string
): Promise<{ created: number }> {
  const [{ data: meds }, { data: routines }, corrections] = await Promise.all([
    db
      .from('medications')
      .select('id, name, current_dose, form, schedule_hint, rotation_sites, is_active')
      .eq('person_id', personId)
      .eq('is_active', true),
    db.from('routines').select('medication_id').eq('person_id', personId),
    correctionsForPerson(db, personId),
  ])

  const scheduled = new Set((routines ?? []).map((r) => r.medication_id as string))
  const fresh = ((meds ?? []) as MedicationRow[]).filter((m) => !scheduled.has(m.id))
  if (!fresh.length) return { created: 0 }

  const rows = fresh.map((m) => {
    const corrected = applyCorrections(m, corrections.get(factKey('medications', m.id)))
    return {
      person_id: personId,
      medication_id: m.id,
      times: defaultTimes(corrected),
      enabled: true,
    }
  })

  const { error } = await db.from('routines').insert(rows)
  if (error) throw new Error(`routines: ${error.message}`)
  return { created: rows.length }
}
