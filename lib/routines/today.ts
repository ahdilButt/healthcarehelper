import type { SupabaseClient } from '@supabase/supabase-js'
import { applyCorrections, correctionsForPerson, factKey } from '@/lib/facts/read'
import type { DueItem, MedForm } from '@/lib/types'
import { londonDate, londonInstant, partOfDay, type PartOfDay } from './time'
import type { MedicationRow } from './schedule'

/**
 * The Today view (SPEC-FINAL §6): what is due, in three parts of a day, each
 * row a human name and a dose and one tap.
 *
 * Missed is amber, never red — the tone rule is load-bearing here. Someone
 * looking at this screen is often looking at their own bad day.
 */

export interface TodayGroups {
  morning: DueItem[]
  afternoon: DueItem[]
  evening: DueItem[]
}

interface RoutineRow {
  id: string
  medication_id: string
  times: string[]
  enabled: boolean
}

interface TakenRow {
  routine_id: string
  due_at: string
  taken_at: string | null
  site: string | null
}

/** The next site is simply the one after the last one used, going round. */
export function nextSite(sites: string[], last: string | null): string | null {
  if (!sites.length) return null
  if (!last) return sites[0]
  const at = sites.indexOf(last)
  return at < 0 ? sites[0] : sites[(at + 1) % sites.length]
}

export async function buildToday(
  db: SupabaseClient,
  personId: string,
  date = londonDate()
): Promise<{ groups: TodayGroups; badgeCount: number }> {
  const dayStart = londonInstant(date, '00:00').toISOString()
  const dayEnd = londonInstant(date, '23:59').toISOString()

  const [{ data: routines }, { data: meds }, { data: taken }, corrections] = await Promise.all([
    db.from('routines').select('id, medication_id, times, enabled').eq('person_id', personId),
    db
      .from('medications')
      .select('id, name, current_dose, form, schedule_hint, rotation_sites, is_active')
      .eq('person_id', personId),
    db
      .from('taken_events')
      .select('routine_id, due_at, taken_at, site')
      .eq('person_id', personId)
      .lte('due_at', dayEnd)
      .order('due_at', { ascending: true }),
    correctionsForPerson(db, personId),
  ])

  const byMedication = new Map<string, MedicationRow>()
  for (const raw of (meds ?? []) as MedicationRow[]) {
    byMedication.set(raw.id, applyCorrections(raw, corrections.get(factKey('medications', raw.id))))
  }

  const events = (taken ?? []) as TakenRow[]
  const todays = new Map<string, TakenRow>()
  for (const e of events) {
    if (e.due_at >= dayStart) todays.set(`${e.routine_id}@${e.due_at}`, e)
  }

  const groups: TodayGroups = { morning: [], afternoon: [], evening: [] }
  const now = Date.now()
  let badgeCount = 0

  for (const routine of (routines ?? []) as RoutineRow[]) {
    if (!routine.enabled) continue
    const med = byMedication.get(routine.medication_id)
    if (!med || !med.is_active) continue

    const sites = med.rotation_sites ?? []
    // The last site used is the last one ever logged, not just today's — a
    // patch changed at 8am yesterday still decides where today's one goes.
    const lastSite =
      sites.length > 0
        ? (events.filter((e) => e.routine_id === routine.id && e.site).at(-1)?.site ?? null)
        : null

    for (const time of routine.times ?? []) {
      const dueAt = londonInstant(date, time)
      const event = todays.get(`${routine.id}@${dueAt.toISOString()}`)
      const isTaken = Boolean(event?.taken_at)
      if (!isTaken && dueAt.getTime() <= now) badgeCount++

      const item: DueItem = {
        routineId: routine.id,
        medicationId: med.id,
        humanName: med.name,
        dose: med.current_dose,
        form: med.form as MedForm,
        dueAt: dueAt.toISOString(),
        taken: isTaken,
        ...(sites.length
          ? { site: { last: event?.site ?? lastSite, next: nextSite(sites, lastSite) } }
          : {}),
      }
      groups[partOfDay(time) as PartOfDay].push(item)
    }
  }

  for (const key of Object.keys(groups) as PartOfDay[]) {
    groups[key].sort((a, b) => (a.dueAt < b.dueAt ? -1 : a.dueAt > b.dueAt ? 1 : 0))
  }

  return { groups, badgeCount }
}
