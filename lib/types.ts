/** Shared domain types. Mirrors supabase/schema.sql (frozen). */

export type MembershipRole = 'owner' | 'patient' | 'carer'
export type DocumentKind = 'letter_photo' | 'pdf' | 'voice_note' | 'box_photo'
export type DocumentStatus = 'processing' | 'ready' | 'needs_look' | 'merged'
export const MED_FORM_VALUES = [
  'tablet',
  'capsule',
  'patch',
  'gel',
  'injection',
  'inhaler',
  'liquid',
  'other',
] as const
export type MedForm = (typeof MED_FORM_VALUES)[number]
export type LoopType = 'referral' | 'test' | 'letter' | 'follow_up' | 'other'
export const LOOP_STATE_VALUES = ['waiting', 'done', 'overdue'] as const
export type LoopState = (typeof LOOP_STATE_VALUES)[number]
export type CapsuleKind = 'doctor_brief' | 'paramedic' | 'family'
export type NotifType = 'reminder' | 'what_changed'
export type NotifChannel = 'sms' | 'email'

/** The fact tables addressable by /api/facts/:table/:id */
export const FACT_TABLES = [
  'conditions',
  'medications',
  'med_change_events',
  'allergies',
  'results',
  'appointments',
  'open_loops',
] as const
export type FactTable = (typeof FACT_TABLES)[number]

export function isFactTable(v: string): v is FactTable {
  return (FACT_TABLES as readonly string[]).includes(v)
}

export type SourceChip = { documentId: string; label: string }

export type TimelineItemType =
  | 'letter'
  | 'result'
  | 'med_change'
  | 'open_loop'
  | 'needs_look'
  | 'processing'

/** API-CONTRACTS.md: the merged timeline feed item. */
export interface TimelineItem {
  itemType: TimelineItemType
  id: string
  personId: string
  humanTitle: string
  payloadLine: string
  date: string
  confirmed: boolean
  sourceChip: SourceChip
  /** Extra hints the UI uses; never load-bearing for the contract. */
  factTable?: FactTable
  loopState?: LoopState
  /** Someone fixed this fact — the card shows their words, marked as edited. */
  edited?: boolean
}

/** What kind of thing a field holds, so "Fix this" can offer the right control
 * rather than a text box the rest of the app will refuse to understand. */
export type FieldInput = 'text' | 'date' | 'datetime' | 'number' | 'choice'

/** One line of a fact's detail sheet; `correctable` ones carry "Fix this". */
export interface FactField {
  key: string
  label: string
  value: string
  aiValue: string
  edited: boolean
  correctable: boolean
  input: FieldInput
  choices?: string[]
}

export interface FactCorrection {
  id: string
  field: string
  value: string
  at: string
}

/** GET /api/facts/:table/:id — the detail sheet behind every card. */
export interface FactDetail {
  fact: {
    table: FactTable
    id: string
    personId: string
    sourceDocumentId: string
    humanTitle: string
    confidence: number
    confirmed: boolean
    confirmedAt: string | null
    fields: FactField[]
  }
  corrections: FactCorrection[]
  displayValue: string
  edited: boolean
  document: {
    id: string
    transcriptExcerpt: string
    /** False when the value could not be found and the excerpt is just the top
     * of the letter — a citation must never be labelled as one when it isn't. */
    excerptLocated: boolean
  }
}

export interface DueItem {
  routineId: string
  medicationId: string
  humanName: string
  dose: string
  form: MedForm
  dueAt: string
  taken: boolean
  site?: { last: string | null; next: string | null }
}

export interface Citation {
  factTable: FactTable | 'documents'
  factId: string
  documentId: string
  label: string
}

export interface PersonSummary {
  id: string
  displayName: string
  role: MembershipRole
}
