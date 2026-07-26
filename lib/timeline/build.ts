import type { SupabaseClient } from '@supabase/supabase-js'
import {
  applyCorrections,
  correctionsForPerson,
  factKey,
  isConfirmed,
  isoDateOrNull,
  loopStateOf,
} from '@/lib/facts/read'
import type { LoopState, TimelineItem } from '@/lib/types'

/**
 * The merged feed: one chronological story per person (SPEC-FINAL §4).
 *
 * Every card is traceable to the document it came from, and every header is
 * written in human meaning — "Heart medicine dose went up", not "med_change".
 *
 * Cards show the corrected reading, never the original: once someone has fixed
 * a dose, the wrong one must not survive anywhere they can still see it.
 */

interface DocRow {
  id: string
  person_id: string
  kind: string
  doc_type: string | null
  doc_date: string | null
  sender: string | null
  transcript: string | null
  status: string
  created_at: string
  merged_into: string | null
}

/** "from the cardiology letter · 12 May" */
export function sourceLabel(
  doc: Partial<Pick<DocRow, 'doc_type' | 'sender' | 'doc_date' | 'kind'>> | undefined
): string {
  if (!doc) return 'from a document'
  const what = humanDocName(doc.doc_type ?? null, doc.sender ?? null, doc.kind)
  const when = doc.doc_date ? shortDate(doc.doc_date) : null
  return when ? `from the ${what} · ${when}` : `from the ${what}`
}

/**
 * How the upload arrived beats how the extractor classified it. A voice note
 * whose type came back "other" is still a voice note — we watched it being
 * recorded — and calling it "Letter" on the card makes the one thing the user
 * just did look like it did not happen.
 */
const BY_KIND: Record<string, string> = {
  voice_note: 'voice note',
  box_photo: 'photo of the box',
}

export function humanDocName(docType: string | null, sender: string | null, kind?: string): string {
  const generic = !docType || docType === 'other'
  if (kind && (generic || BY_KIND[kind])) {
    const known = BY_KIND[kind]
    if (known) return known
  }
  return docNameFromType(docType, sender)
}

function docNameFromType(docType: string | null, sender: string | null): string {
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

type FactBase = {
  id: string
  source_document_id: string
  confidence: number
  confirmed_at: string | null
  created_at: string
}
type ChangeRow = FactBase & {
  medication_id: string
  old_dose: string | null
  new_dose: string
  changed_on: string | null
}
type ResultRow = FactBase & {
  name: string
  value: number | string | null
  value_text: string | null
  unit: string | null
  result_date: string | null
}
type LoopRow = FactBase & {
  loop_type: string
  description: string
  expected_date: string | null
  state: LoopState
}

export async function buildTimeline(
  db: SupabaseClient,
  personId: string,
  limit = 60
): Promise<TimelineItem[]> {
  const [docsRes, resultsRes, changesRes, loopsRes, medsRes, corrections] = await Promise.all([
    db.from('documents').select('*').eq('person_id', personId).order('created_at', { ascending: false }),
    db.from('results').select('*').eq('person_id', personId),
    db.from('med_change_events').select('*').eq('person_id', personId),
    db.from('open_loops').select('*').eq('person_id', personId),
    db.from('medications').select('id,name').eq('person_id', personId),
    // One query for every fix this person has made, rather than one per card.
    correctionsForPerson(db, personId),
  ])

  const meds = (medsRes.data ?? []) as { id: string; name: string }[]
  const medName = new Map<string, string>(
    meds.map((m) => [m.id, applyCorrections(m, corrections.get(factKey('medications', m.id))).name])
  )

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
      humanTitle: capitalise(humanDocName(d.doc_type, d.sender, d.kind)),
      payloadLine: documentLine(d),
      date: dateOf(d, d.created_at),
      confirmed: true,
      sourceChip: chip,
    })
  }

  // ---- med changes: the "what changed" star
  for (const c of (changesRes.data ?? []) as ChangeRow[]) {
    const doc = byId.get(c.source_document_id)
    if (doc?.status === 'merged') continue
    const fixes = corrections.get(factKey('med_change_events', c.id))
    const row = applyCorrections(c, fixes)
    const name = medName.get(c.medication_id) ?? null
    items.push({
      itemType: 'med_change',
      id: c.id,
      personId,
      // Human meaning first (SPEC-FINAL §4), the clinical detail underneath.
      humanTitle: name ? `${name} ${changeVerb(row.old_dose, row.new_dose)}` : 'A medicine changed',
      payloadLine: row.old_dose
        ? `${name ?? 'The dose'} is now ${row.new_dose} (was ${row.old_dose})`
        : `Started ${name ?? 'a new medicine'} ${row.new_dose}`,
      date: isoDateOrNull(row.changed_on) ?? dateOf(doc, c.created_at),
      confirmed: isConfirmed(Number(c.confidence), c.confirmed_at),
      sourceChip: { documentId: c.source_document_id, label: sourceLabel(doc) },
      factTable: 'med_change_events',
      edited: Boolean(fixes),
    })
  }

  // ---- results
  for (const r of (resultsRes.data ?? []) as ResultRow[]) {
    const doc = byId.get(r.source_document_id)
    if (doc?.status === 'merged') continue
    const fixes = corrections.get(factKey('results', r.id))
    const row = applyCorrections(r, fixes)
    const reading = row.value === null || row.value === '' ? null : row.value
    const value = reading !== null ? `${reading}${row.unit ? ` ${row.unit}` : ''}` : row.value_text
    items.push({
      itemType: 'result',
      id: r.id,
      personId,
      humanTitle: `${row.name} result`,
      payloadLine: String(value ?? ''),
      date: isoDateOrNull(row.result_date) ?? dateOf(doc, r.created_at),
      confirmed: isConfirmed(Number(r.confidence), r.confirmed_at),
      sourceChip: { documentId: r.source_document_id, label: sourceLabel(doc) },
      factTable: 'results',
      edited: Boolean(fixes),
    })
  }

  // ---- open loops: "Things to watch"
  for (const l of (loopsRes.data ?? []) as LoopRow[]) {
    const doc = byId.get(l.source_document_id)
    if (doc?.status === 'merged') continue
    const fixes = corrections.get(factKey('open_loops', l.id))
    const row = applyCorrections(l, fixes)
    const state = loopStateOf(row.state, l.state)
    items.push({
      itemType: 'open_loop',
      id: l.id,
      personId,
      humanTitle: loopTitle(row.description, l.loop_type),
      payloadLine: loopPayload(row.description, isoDateOrNull(row.expected_date), state),
      date: isoDateOrNull(row.expected_date) ?? dateOf(doc, l.created_at),
      confirmed: isConfirmed(Number(l.confidence), l.confirmed_at),
      sourceChip: { documentId: l.source_document_id, label: sourceLabel(doc) },
      factTable: 'open_loops',
      loopState: state,
      edited: Boolean(fixes),
    })
  }

  items.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return items.slice(0, limit)
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * What a document card says under its heading.
 *
 * A letter has a sender, which is the useful line. A voice note has nobody —
 * it has words, and "Added to the record" told the person who just spoke them
 * nothing at all. So a note quotes itself.
 */
const SPOKEN_KINDS = new Set(['voice_note'])
const SNIPPET_MAX = 120

function documentLine(d: DocRow): string {
  const said = (d.transcript ?? '').trim().replace(/\s+/g, ' ')
  if (SPOKEN_KINDS.has(d.kind) && said) return `“${snippet(said)}”`
  return d.sender ?? said.slice(0, SNIPPET_MAX) ?? 'Added to the record'
}

function snippet(text: string): string {
  if (text.length <= SNIPPET_MAX) return text
  const cut = text.slice(0, SNIPPET_MAX)
  return `${cut.slice(0, cut.lastIndexOf(' ')).trim()}…`
}

/**
 * A card header has to say what the thing IS.
 *
 * "Something to watch" told the reader nothing — every open loop wore the same
 * two words, so a screen full of them was a screen of identical cards. The
 * description already contains the answer; it just needs the first clause,
 * short enough to read at a glance.
 */
const LOOP_FALLBACK: Record<string, string> = {
  referral: 'A referral to chase',
  test: 'A test to book',
  letter: 'A letter to expect',
  follow_up: 'Something to keep an eye on',
  other: 'Something to watch',
}

const TITLE_MAX = 52

export function loopTitle(description: unknown, loopType: string): string {
  const full = String(description ?? '').trim()
  if (!full) return LOOP_FALLBACK[loopType] ?? LOOP_FALLBACK.other

  // Everything before the first aside is the thing itself; what follows is
  // usually who, where, or by when — which the card says elsewhere.
  let head = full.split(/\s*[(;—]|,\s(?=[a-z])/)[0].trim()
  if (head.length > TITLE_MAX) {
    const cut = head.slice(0, TITLE_MAX)
    head = `${cut.slice(0, cut.lastIndexOf(' ')).trim()}…`
  }
  return capitalise(head)
}

/** The header says what it is, so the line underneath says when. */
export function loopPayload(
  description: unknown,
  expected: string | null,
  state: LoopState
): string {
  const full = String(description ?? '').trim()
  const title = loopTitle(full, 'other')
  const rest = title.endsWith('…') || full.length > title.length ? full : ''

  const when = expected
    ? state === 'overdue'
      ? `Was expected by ${shortDate(expected)} — nothing has come`
      : `Expected by ${shortDate(expected)}`
    : state === 'overdue'
      ? 'Nothing has come of this yet'
      : ''

  return [when, rest].filter(Boolean).join(' · ')
}

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
