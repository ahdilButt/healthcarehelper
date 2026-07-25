import type { SupabaseClient } from '@supabase/supabase-js'
import { CONFIRMED_THRESHOLD } from '@/lib/constants'
import { applyCorrections, correctionsForPerson, factKey, whenLabel } from '@/lib/facts/read'
import type { CapsuleKind, FactTable } from '@/lib/types'

/**
 * What a capsule shows (SPEC-FINAL §7).
 *
 * Two rules decide everything in this file. Only confirmed facts cross into a
 * capsule — a clinician reading this has no way to know which line the machine
 * was unsure about, so an unsure line must not be there at all. And each kind
 * shows exactly its preset and nothing more: a family link that quietly leaked
 * a diagnosis would be a betrayal of the person whose record it is.
 */

export interface CapsuleSection {
  heading: string
  lines: { text: string; note?: string }[]
  /** Shown as a sentence rather than an empty list — absence is information. */
  emptyText: string
}

export interface CapsulePayload {
  personName: string
  sections: CapsuleSection[]
  emergencyContact?: { name: string; phone: string; relationship?: string } | null
  dnr?: boolean | null
}

const SCOPES: Record<CapsuleKind, FactTable[]> = {
  // The clinical order is fixed and deliberate: the thing that can kill someone
  // first, then what they take, then what they have, then the numbers.
  doctor_brief: ['allergies', 'medications', 'conditions', 'results', 'open_loops'],
  paramedic: ['allergies', 'medications', 'conditions'],
  family: ['medications', 'appointments'],
}

export const SCOPE_SUMMARY: Record<CapsuleKind, string> = {
  doctor_brief:
    'Allergies, current medicines, active problems, recent results, and anything still in the air.',
  paramedic: 'Allergies, current medicines, problems, emergency contact and DNR status.',
  family: 'Current medicines and upcoming appointments. Nothing else.',
}

export const KIND_TITLE: Record<CapsuleKind, string> = {
  doctor_brief: 'Doctor brief',
  paramedic: 'Emergency card',
  family: 'For family',
}

const HEADINGS: Record<FactTable, string> = {
  allergies: 'Allergies',
  medications: 'Current medicines',
  conditions: 'Active problems',
  results: 'Recent results',
  open_loops: 'In flight',
  appointments: 'Upcoming appointments',
  med_change_events: 'Recent changes',
}

const EMPTY: Record<FactTable, string> = {
  allergies: 'None recorded.',
  medications: 'None recorded.',
  conditions: 'None recorded.',
  results: 'No recent results recorded.',
  open_loops: 'Nothing outstanding recorded.',
  appointments: 'None recorded.',
  med_change_events: 'None recorded.',
}

/** Enough to be useful at a bedside without becoming a lab printout. */
const RECENT_RESULTS = 8

type Row = Record<string, unknown>

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())

export async function buildCapsule(
  db: SupabaseClient,
  personId: string,
  kind: CapsuleKind
): Promise<CapsulePayload> {
  const tables = SCOPES[kind]
  const [{ data: person }, corrections, ...results] = await Promise.all([
    db.from('persons').select('display_name, emergency_contact, dnr_status').eq('id', personId).maybeSingle(),
    correctionsForPerson(db, personId),
    ...tables.map((t) => db.from(t).select('*').eq('person_id', personId)),
  ])

  const sections: CapsuleSection[] = []

  tables.forEach((table, i) => {
    const rows = ((results[i]?.data ?? []) as Row[])
      // The confirmation rule, applied before anything is formatted.
      .filter((r) => Number(r.confidence ?? 0) >= CONFIRMED_THRESHOLD || r.confirmed_at)
      .map((r) => applyCorrections(r, corrections.get(factKey(table, String(r.id)))))

    sections.push({
      heading: HEADINGS[table],
      emptyText: EMPTY[table],
      lines: format(table, rows),
    })
  })

  return {
    personName: person?.display_name ?? 'This person',
    sections,
    ...(kind === 'paramedic'
      ? {
          emergencyContact: (person?.emergency_contact ?? null) as CapsulePayload['emergencyContact'],
          dnr: (person?.dnr_status ?? null) as boolean | null,
        }
      : {}),
  }
}

function format(table: FactTable, rows: Row[]): CapsuleSection['lines'] {
  switch (table) {
    case 'allergies':
      return rows.map((r) => ({
        text: text(r.substance).toUpperCase(),
        note: text(r.reaction) || undefined,
      }))

    case 'medications':
      return rows
        .filter((r) => r.is_active !== false)
        .map((r) => ({
          text: `${text(r.name)} — ${text(r.current_dose)}`,
          note: text(r.schedule_hint) || undefined,
        }))

    case 'conditions':
      return rows
        .filter((r) => text(r.status) !== 'resolved')
        .map((r) => ({ text: text(r.name) }))

    case 'results':
      return rows
        .slice()
        .sort((a, b) => text(b.result_date).localeCompare(text(a.result_date)))
        .slice(0, RECENT_RESULTS)
        .map((r) => {
          const value = text(r.value) || text(r.value_text)
          const unit = text(r.unit)
          const range =
            r.ref_low !== null || r.ref_high !== null
              ? `ref ${text(r.ref_low) || '–'}–${text(r.ref_high) || '–'}`
              : ''
          return {
            text: `${text(r.name)}: ${value}${unit ? ` ${unit}` : ''}${r.flagged ? ' *' : ''}`,
            note: [text(r.result_date), range].filter(Boolean).join(' · ') || undefined,
          }
        })

    case 'open_loops':
      return rows
        .filter((r) => text(r.state) !== 'done')
        .map((r) => ({
          text: text(r.description),
          note: r.expected_date
            ? `expected by ${text(r.expected_date)}${text(r.state) === 'overdue' ? ' — overdue' : ''}`
            : undefined,
        }))

    case 'appointments':
      return rows
        .slice()
        .sort((a, b) => text(a.starts_at).localeCompare(text(b.starts_at)))
        .map((r) => ({
          text: text(r.title),
          note: [whenLabel(r.starts_at), text(r.location)].filter(Boolean).join(' · ') || undefined,
        }))

    default:
      return rows.map((r) => ({ text: text(r.id) }))
  }
}
