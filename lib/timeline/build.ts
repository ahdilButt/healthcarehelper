import type { SupabaseClient } from '@supabase/supabase-js'
import { CONFIRMED_THRESHOLD } from '@/lib/constants'
import type { TimelineItem } from '@/lib/types'

/**
 * The merged feed: one chronological story per person (SPEC-FINAL §4).
 *
 * Every card is traceable to the document it came from, and every header is
 * written in human meaning — "Heart medicine dose went up", not "med_change".
 */

const confirmed = (c: number, at: string | null) => c >= CONFIRMED_THRESHOLD || Boolean(at)

interface DocRow {
  id: string
  person_id: string
  kind: string
  doc_type: string | null
  doc_date: string | null
  sender: string | null
  status: string
  created_at: string
  merged_into: string | null
}

/** "from the cardiology letter · 12 May" */
export function sourceLabel(doc: Pick<DocRow, 'doc_type' | 'sender' | 'doc_date'> | undefined): string {
  if (!doc) return 'from a document'
  const what = humanDocName(doc.doc_type, doc.sender)
  const when = doc.doc_date ? shortDate(doc.doc_date) : null
  return when ? `from the ${what} · ${when}` : `from the ${what}`
}

export function humanDocName(docType: string | null, sender: string | null): string {
  const byType: Record<string, string> = {
    clinic_letter: 'clinic letter',
    discharge_summary: 'hospital stay summary',
    blood_panel: 'blood test results',
    imaging_report: 'scan report',
    referral_letter: 'referral letter',
    medication_review: 'medicines review',
    appointment_letter: 'appointment letter',
    screening_invite: 'screening letter',
    admin_letter: 'letter',
    voice_note: 'voice note',
    medicine_box: 'photo of the box',
    pharmacy_slip: 'pharmacy slip',
  }
  const base = byType[docType ?? ''] ?? 'letter'
  // "Cardiology, St Saviour's" -> "cardiology letter"
  const specialty = sender?.split(',')[0]?.replace(/^Department of\s+/i, '').trim()
  if (specialty && base === 'clinic letter') return `${specialty.toLowerCase()} letter`
  return base
}

export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`
}

export function monthLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export async function buildTimeline(
  db: SupabaseClient,
  personId: string,
  limit = 60
): Promise<TimelineItem[]> {
  const [docsRes, resultsRes, changesRes, loopsRes, medsRes] = await Promise.all([
    db.from('documents').select('*').eq('person_id', personId).order('created_at', { ascending: false }),
    db.from('results').select('*').eq('person_id', personId),
    db.from('med_change_events').select('*').eq('person_id', personId),
    db.from('open_loops').select('*').eq('person_id', personId),
    db.from('medications').select('id,name').eq('person_id', personId),
  ])

  const medName = new Map<string, string>((medsRes.data ?? []).map((m) => [m.id, m.name]))

  const docs = (docsRes.data ?? []) as DocRow[]
  const byId = new Map(docs.map((d) => [d.id, d]))
  const items: TimelineItem[] = []

  const dateOf = (doc: DocRow | undefined, fallback: string) =>
    doc?.doc_date ?? (doc?.created_at ?? fallback).slice(0, 10)

  // ---- documents themselves: letter / processing / needs-a-look
  for (const d of docs) {
    if (d.merged_into && d.merged_into !== d.id) continue // merged away
    const chip = { documentId: d.id, label: sourceLabel(d) }

    if (d.status === 'processing') {
      items.push({
        itemType: 'processing',
        id: d.id,
        personId,
        humanTitle: 'Reading the letter…',
        payloadLine: 'This takes a few seconds.',
        date: d.created_at.slice(0, 10),
        confirmed: true,
        sourceChip: chip,
      })
      continue
    }

    if (d.status === 'needs_look') {
      items.push({
        itemType: 'needs_look',
        id: d.id,
        personId,
        humanTitle: 'Needs a look',
        payloadLine: 'We could not read this one. Tap to retake it or type what it says.',
        date: dateOf(d, d.created_at),
        confirmed: true,
        sourceChip: chip,
      })
      continue
    }

    items.push({
      itemType: 'letter',
      id: d.id,
      personId,
      humanTitle: capitalise(humanDocName(d.doc_type, d.sender)),
      payloadLine: d.sender ?? 'Added to the record',
      date: dateOf(d, d.created_at),
      confirmed: true,
      sourceChip: chip,
    })
  }

  // ---- med changes: the "what changed" star
  for (const c of changesRes.data ?? []) {
    const doc = byId.get(c.source_document_id)
    if (doc?.status === 'merged') continue
    const name = medName.get(c.medication_id) ?? null
    items.push({
      itemType: 'med_change',
      id: c.id,
      personId,
      // Human meaning first (SPEC-FINAL §4), the clinical detail underneath.
      humanTitle: name ? `${name} ${changeVerb(c.old_dose, c.new_dose)}` : 'A medicine changed',
      payloadLine: c.old_dose
        ? `${name ?? 'The dose'} is now ${c.new_dose} (was ${c.old_dose})`
        : `Started ${name ?? 'a new medicine'} ${c.new_dose}`,
      date: c.changed_on ?? dateOf(doc, c.created_at),
      confirmed: confirmed(Number(c.confidence), c.confirmed_at),
      sourceChip: { documentId: c.source_document_id, label: sourceLabel(doc) },
      factTable: 'med_change_events',
    })
  }

  // ---- results
  for (const r of resultsRes.data ?? []) {
    const doc = byId.get(r.source_document_id)
    if (doc?.status === 'merged') continue
    const value = r.value !== null ? `${r.value}${r.unit ? ` ${r.unit}` : ''}` : r.value_text
    items.push({
      itemType: 'result',
      id: r.id,
      personId,
      humanTitle: `${r.name} result`,
      payloadLine: String(value ?? ''),
      date: r.result_date ?? dateOf(doc, r.created_at),
      confirmed: confirmed(Number(r.confidence), r.confirmed_at),
      sourceChip: { documentId: r.source_document_id, label: sourceLabel(doc) },
      factTable: 'results',
    })
  }

  // ---- open loops: "Things to watch"
  for (const l of loopsRes.data ?? []) {
    const doc = byId.get(l.source_document_id)
    if (doc?.status === 'merged') continue
    items.push({
      itemType: 'open_loop',
      id: l.id,
      personId,
      humanTitle: l.state === 'overdue' ? 'This looks overdue' : 'Something to watch',
      payloadLine: l.description,
      date: l.expected_date ?? dateOf(doc, l.created_at),
      confirmed: confirmed(Number(l.confidence), l.confirmed_at),
      sourceChip: { documentId: l.source_document_id, label: sourceLabel(doc) },
      factTable: 'open_loops',
      loopState: l.state,
    })
  }

  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return items.slice(0, limit)
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * "dose went up" is only true if it did. Compare the strengths so a reduction
 * never reads as an increase on a card someone is trusting.
 */
function changeVerb(oldDose: string | null, newDose: string): string {
  if (!oldDose) return 'was started'
  const a = strengthValue(oldDose)
  const b = strengthValue(newDose)
  if (a === null || b === null) return 'dose changed'
  if (b > a) return 'dose went up'
  if (b < a) return 'dose went down'
  return 'dose changed'
}

/** Milligram-equivalent magnitude, for direction only. */
function strengthValue(dose: string): number | null {
  const m = dose.match(/(\d+(?:\.\d+)?)\s*(mcg|microgram|micrograms|mg|g)\b/i)
  if (!m) return null
  const n = parseFloat(m[1])
  const unit = m[2].toLowerCase()
  if (unit === 'g') return n * 1000
  if (unit.startsWith('mc') || unit.startsWith('micro')) return n / 1000
  return n
}
