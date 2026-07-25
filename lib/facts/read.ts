import type { SupabaseClient } from '@supabase/supabase-js'
import { APP_TIMEZONE, CONFIRMED_THRESHOLD } from '@/lib/constants'
import {
  LOOP_STATE_VALUES,
  MED_FORM_VALUES,
  type FactCorrection,
  type FactField,
  type FactTable,
  type FieldInput,
  type LoopState,
} from '@/lib/types'

/**
 * The correction overlay (SPEC-FINAL §3).
 *
 * The extraction is immutable — a human fix is an append-only row in
 * `corrections`, never an edit to the fact. Every surface that shows a fact
 * reads it back through this file, so a fix made on the timeline can never be
 * missing from a capsule, a reminder or an answer.
 */

export type FactRow = Record<string, unknown>
export type CorrectionMap = Record<string, string | FactCorrection>

/**
 * Fields a person can sensibly fix. Everything else is machinery (person_id,
 * confidence) or derived, where a correction would have no honest meaning.
 * `results.value_text` sits beside `value` because a non-numeric reading
 * ("no acute changes") lives in that column and must be fixable too.
 */
export const CORRECTABLE_FIELDS: Record<FactTable, string[]> = {
  conditions: ['name', 'status'],
  medications: ['name', 'current_dose', 'form', 'schedule_hint'],
  med_change_events: ['old_dose', 'new_dose', 'changed_on'],
  allergies: ['substance', 'reaction'],
  results: ['name', 'value', 'value_text', 'unit', 'result_date'],
  appointments: ['title', 'location', 'starts_at'],
  open_loops: ['description', 'expected_date', 'state'],
}

/** Read-only lines the detail sheet still shows, after the fixable ones. */
const EXTRA_FIELDS: Partial<Record<FactTable, string[]>> = {
  medications: ['is_active'],
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  status: 'Status',
  current_dose: 'Dose',
  form: 'How it is taken',
  schedule_hint: 'When to take it',
  is_active: 'Still taking it',
  old_dose: 'Was',
  new_dose: 'Now',
  changed_on: 'Changed on',
  substance: 'What to avoid',
  reaction: 'What happens',
  value: 'Reading',
  value_text: 'Reading in words',
  unit: 'Units',
  result_date: 'Date of the test',
  title: 'What it is',
  location: 'Where',
  starts_at: 'When',
  description: 'What is expected',
  expected_date: 'Expected by',
  state: 'Where it has got to',
}

/** The same column wants a different word depending on what it describes. */
const TABLE_LABELS: Partial<Record<FactTable, Record<string, string>>> = {
  conditions: { name: 'What it is called' },
  medications: { name: 'Medicine' },
  results: { name: 'What was measured' },
}

export function labelFor(table: FactTable, key: string): string {
  const fallback = key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())
  return TABLE_LABELS[table]?.[key] ?? FIELD_LABELS[key] ?? fallback
}

const text = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v).trim()
}

/** "46.00" and "46" are the same reading; the letter only printed one of them. */
const numText = (v: unknown): string => {
  const raw = text(v)
  const n = Number(raw)
  return raw && Number.isFinite(n) ? String(n) : raw
}

export const isConfirmed = (confidence: number, confirmedAt: string | null): boolean =>
  confidence >= CONFIRMED_THRESHOLD || Boolean(confirmedAt)

/**
 * A hand-typed date only replaces a sort key when it is still a date — free
 * text in a date field must never scramble the order of the story.
 */
export const isoDateOrNull = (v: unknown): string | null =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null

const LOOP_STATES = new Set<string>(LOOP_STATE_VALUES)

/** Nor may a hand-typed state become one the app has no card for. */
export const loopStateOf = (v: unknown, fallback: LoopState): LoopState =>
  typeof v === 'string' && LOOP_STATES.has(v) ? (v as LoopState) : fallback

/**
 * What a fixable field actually holds, and the words to use when someone types
 * something the rest of the app cannot read.
 *
 * A correction that the feed then quietly ignores is worse than no correction
 * at all: the sheet would show the person's words while the card kept the
 * machine's. So every value is normalised here, at the one door corrections
 * come through, and anything unreadable is refused out loud.
 */
export interface FieldRule {
  input: FieldInput
  choices?: readonly string[]
  hint: string
}

const DATE_HINT = 'Use a date like 12/05/2026.'

export const FIELD_RULES: Record<string, FieldRule> = {
  'med_change_events.changed_on': { input: 'date', hint: DATE_HINT },
  'results.result_date': { input: 'date', hint: DATE_HINT },
  'open_loops.expected_date': { input: 'date', hint: DATE_HINT },
  'appointments.starts_at': {
    input: 'datetime',
    hint: 'Use a date like 14/07/2026, with a time like 10:20 if the letter gives one.',
  },
  'results.value': {
    input: 'number',
    hint: 'Use just the number — the units have their own line.',
  },
  'open_loops.state': {
    input: 'choice',
    choices: LOOP_STATE_VALUES,
    hint: 'Say whether it is still waiting, done, or overdue.',
  },
  'conditions.status': {
    input: 'choice',
    choices: ['active', 'resolved'],
    hint: 'Say whether it is active or resolved.',
  },
  'medications.form': {
    input: 'choice',
    choices: MED_FORM_VALUES,
    hint: 'Say how it is taken — a tablet, a patch, a capsule, and so on.',
  },
}

const TEXT_RULE: FieldRule = { input: 'text', hint: 'Type what it should say.' }

export const ruleFor = (table: FactTable, field: string): FieldRule =>
  FIELD_RULES[`${table}.${field}`] ?? TEXT_RULE

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const pad = (n: number) => String(n).padStart(2, '0')

function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  const at = new Date(Date.UTC(year, month - 1, day))
  // Rejects 31 February rather than letting it roll into March.
  if (at.getUTCMonth() !== month - 1 || at.getUTCDate() !== day) return null
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Day before month, because that is how the letters are written and how the
 * family types. "05/12/2026" is December, never May. */
export function parseUkDate(raw: string): string | null {
  const s = raw.trim()
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) return ymd(Number(iso[1]), Number(iso[2]), Number(iso[3]))

  const numeric = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/)
  if (numeric) {
    const year = Number(numeric[3])
    return ymd(year < 100 ? 2000 + year : year, Number(numeric[2]), Number(numeric[1]))
  }

  const worded = s.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/)
  if (worded) {
    const month = MONTHS.indexOf(worded[2].slice(0, 3).toLowerCase()) + 1
    if (month) return ymd(Number(worded[3]), month, Number(worded[1]))
  }
  return null
}

/**
 * A hand-typed value in the shape the rest of the app reads, or null when it
 * cannot be understood. Never guesses: an unreadable date is refused, not
 * silently dropped.
 */
export function normaliseCorrection(table: FactTable, field: string, raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const rule = ruleFor(table, field)

  switch (rule.input) {
    case 'date':
      return parseUkDate(value)
    case 'datetime': {
      const [datePart, timePart] = value.split(/[T\s]+/, 2)
      const date = parseUkDate(datePart ?? '')
      if (!date) return null
      const time = timePart?.match(/^(\d{1,2}):(\d{2})/)
      if (!time) return date
      const hour = Number(time[1])
      const minute = Number(time[2])
      if (hour > 23 || minute > 59) return null
      return `${date}T${pad(hour)}:${pad(minute)}`
    }
    case 'number':
      return Number.isFinite(Number(value)) ? String(Number(value)) : null
    case 'choice': {
      const match = rule.choices?.find((c) => c.toLowerCase() === value.toLowerCase())
      return match ?? null
    }
    default:
      return value
  }
}

export const factKey = (table: string, id: string) => `${table}:${id}`

interface CorrectionRow {
  id: string
  field: string
  corrected_value: string
  created_at: string
}

interface PersonCorrectionRow extends CorrectionRow {
  fact_table: string
  fact_id: string
}

export async function listCorrections(
  db: SupabaseClient,
  factTable: FactTable,
  factId: string
): Promise<FactCorrection[]> {
  const { data } = await db
    .from('corrections')
    .select('id, field, corrected_value, created_at')
    .eq('fact_table', factTable)
    .eq('fact_id', factId)
    .order('created_at', { ascending: false })

  return ((data ?? []) as CorrectionRow[]).map((c) => ({
    id: c.id,
    field: c.field,
    value: c.corrected_value,
    at: c.created_at,
  }))
}

/** Corrections are append-only and newest first: the first row wins its field. */
export function latestOf(rows: FactCorrection[]): Record<string, FactCorrection> {
  const latest: Record<string, FactCorrection> = {}
  for (const c of rows) if (!(c.field in latest)) latest[c.field] = c
  return latest
}

export async function latestCorrections(
  db: SupabaseClient,
  factTable: FactTable,
  factId: string
): Promise<Record<string, FactCorrection>> {
  return latestOf(await listCorrections(db, factTable, factId))
}

/**
 * Every correction a person has ever made, in one query, keyed `table:id`.
 * List surfaces (timeline, Today, capsules) need this — a query per row turns
 * a 60-card feed into 60 round trips.
 */
export async function correctionsForPerson(
  db: SupabaseClient,
  personId: string
): Promise<Map<string, Record<string, string>>> {
  const { data } = await db
    .from('corrections')
    .select('id, fact_table, fact_id, field, corrected_value, created_at')
    .eq('person_id', personId)
    .order('created_at', { ascending: false })

  const byFact = new Map<string, Record<string, string>>()
  for (const c of (data ?? []) as PersonCorrectionRow[]) {
    const key = factKey(c.fact_table, c.fact_id)
    const fields = byFact.get(key) ?? {}
    if (!(c.field in fields)) fields[c.field] = c.corrected_value
    byFact.set(key, fields)
  }
  return byFact
}

export function applyCorrections<T extends object>(row: T, corrections?: CorrectionMap): T {
  if (!corrections) return row
  const overlay: Record<string, unknown> = {}
  for (const [field, correction] of Object.entries(corrections)) {
    // Only overlay columns the row actually has — a correction left behind by an
    // older shape must not invent a field nothing downstream expects.
    if (field in row) overlay[field] = typeof correction === 'string' ? correction : correction.value
  }
  return { ...row, ...overlay }
}

export function whenLabel(value: unknown): string {
  const raw = text(value)
  if (!raw) return ''

  // A hand-typed "14/07/2026 10:20" carries no timezone, so reading it through
  // Date would move it by an hour every British summer. Format the parts.
  const plain = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/)
  if (plain) {
    const day = new Date(Date.UTC(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3])))
    const date = day.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    return plain[4] ? `${date}, ${plain[4]}:${plain[5]}` : date
  }

  const at = new Date(raw)
  if (Number.isNaN(at.getTime())) return raw
  return at.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  })
}

/** The one human line for a fact, corrections already applied. */
const DISPLAY: Record<FactTable, (row: FactRow) => string> = {
  conditions: (r) => text(r.name),
  medications: (r) => text(r.current_dose) || text(r.name),
  med_change_events: (r) =>
    text(r.old_dose) ? `now ${text(r.new_dose)} (was ${text(r.old_dose)})` : `now ${text(r.new_dose)}`,
  allergies: (r) => (text(r.reaction) ? `${text(r.substance)} — ${text(r.reaction)}` : text(r.substance)),
  results: (r) => {
    const value = numText(r.value) || text(r.value_text)
    const unit = text(r.unit)
    return value && unit ? `${value} ${unit}` : value
  },
  appointments: (r) => {
    const when = whenLabel(r.starts_at)
    return when ? `${text(r.title)} · ${when}` : text(r.title)
  },
  open_loops: (r) => text(r.description),
}

export const displayValueOf = (table: FactTable, row: FactRow): string => DISPLAY[table](row)

export interface TitleContext {
  medicationName?: string | null
}

const TITLE: Record<FactTable, (row: FactRow, ctx: TitleContext) => string> = {
  conditions: (r) => text(r.name),
  medications: (r) => text(r.name),
  med_change_events: (r, ctx) => (ctx.medicationName ? `${ctx.medicationName} dose changed` : 'A medicine changed'),
  allergies: (r) => `${text(r.substance)} allergy`,
  results: (r) => `${text(r.name)} result`,
  appointments: (r) => text(r.title),
  open_loops: (r) => (text(r.state) === 'overdue' ? 'This looks overdue' : 'Something to watch'),
}

export const humanTitleOf = (table: FactTable, row: FactRow, ctx: TitleContext = {}): string =>
  TITLE[table](row, ctx)

export function fieldsFor(
  table: FactTable,
  row: FactRow,
  latest: Record<string, FactCorrection> = {}
): FactField[] {
  const correctable = CORRECTABLE_FIELDS[table]
  const fields: FactField[] = []

  for (const key of [...correctable, ...(EXTRA_FIELDS[table] ?? [])]) {
    const aiValue = text(row[key])
    const correction = latest[key]
    const canFix = correctable.includes(key)
    // An empty read-only line is noise; an empty fixable one is an invitation.
    if (!aiValue && !correction && !canFix) continue
    const rule = ruleFor(table, key)
    fields.push({
      key,
      label: labelFor(table, key),
      value: correction ? correction.value : aiValue,
      aiValue,
      edited: Boolean(correction),
      correctable: canFix,
      input: rule.input,
      ...(rule.choices ? { choices: [...rule.choices] } : {}),
    })
  }
  return fields
}

/**
 * What to look for in the transcript, most specific first. Always built from
 * the ORIGINAL row: the page contains what was read, not what was corrected.
 */
const LOCATORS: Record<FactTable, (row: FactRow) => string[]> = {
  conditions: (r) => [text(r.name)],
  medications: (r) => [`${text(r.name)} ${text(r.current_dose)}`, text(r.current_dose), text(r.name)],
  med_change_events: (r) => [text(r.new_dose), text(r.old_dose)],
  allergies: (r) => [text(r.substance), text(r.reaction)],
  results: (r) => {
    const value = numText(r.value) || text(r.value_text)
    return [`${text(r.name)} ${value}`, value, text(r.name)]
  },
  appointments: (r) => [text(r.title), text(r.location)],
  open_loops: (r) => [text(r.description), firstWords(text(r.description), 6), longestWord(text(r.description))],
}

export const locatorsFor = (table: FactTable, row: FactRow): string[] =>
  LOCATORS[table](row).filter((s) => s.trim().length > 1)

const firstWords = (s: string, n: number) => s.split(/\s+/).slice(0, n).join(' ')

const longestWord = (s: string) =>
  s.split(/[^A-Za-z]+/).reduce((best, w) => (w.length > best.length ? w : best), '')

const EXCERPT_CHARS = 400
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Whitespace-tolerant in both directions: a dose can wrap a line, and the
 * record's "5mg" has to find the letter's "5 mg" as readily as the reverse.
 * The leading \b stops "5mg" from matching inside "15mg".
 */
function locate(hay: string, needles: string[]): number {
  for (const needle of needles) {
    const tokens = needle
      .trim()
      .split(/\s+/)
      .slice(0, 8)
      .filter(Boolean)
      .map((t) => escapeRe(t).replace(/(\d)(?=[a-zA-Z])/g, '$1\\s*'))
    if (!tokens.length) continue
    const at = hay.search(new RegExp(`\\b${tokens.join('\\s*')}`, 'i'))
    if (at >= 0) return at
  }
  return -1
}

export interface Excerpt {
  text: string
  /** True only when the value itself was found in these words. */
  located: boolean
}

/**
 * The citation made physical (SPEC-FINAL §4): the window of the transcript the
 * value was read from, so a person can see the words themselves rather than be
 * asked to trust a number.
 *
 * When the value cannot be found — a summarised open loop, "5mg" against a
 * letter that prints "5 mg" — it falls back to the opening of the document and
 * says so. Someone checking an amber reading must never be shown the address
 * block under a heading claiming it is the line the number came from.
 */
export function transcriptExcerpt(
  transcript: string | null,
  needles: string[],
  size = EXCERPT_CHARS
): Excerpt {
  const full = (transcript ?? '').trim()
  if (!full) return { text: '', located: false }

  const at = locate(full, needles)
  if (full.length <= size) return { text: full, located: at >= 0 }
  if (at < 0) return { text: `${full.slice(0, size).trimEnd()}…`, located: false }

  const end = Math.min(full.length, Math.max(0, at - Math.floor(size / 2)) + size)
  const start = Math.max(0, end - size)
  const space = start > 0 ? full.indexOf(' ', start) : -1
  const from = space >= 0 && space - start < 20 ? space + 1 : start
  const body = full.slice(from, end).trim()
  return {
    text: `${from > 0 ? '…' : ''}${body}${end < full.length ? '…' : ''}`,
    located: true,
  }
}
