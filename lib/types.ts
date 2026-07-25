/** Shared domain types. Mirrors supabase/schema.sql (frozen). */

export type MembershipRole = 'owner' | 'patient' | 'carer'
export type DocumentKind = 'letter_photo' | 'pdf' | 'voice_note' | 'box_photo'
export type DocumentStatus = 'processing' | 'ready' | 'needs_look' | 'merged'
export type MedForm =
  | 'tablet'
  | 'capsule'
  | 'patch'
  | 'gel'
  | 'injection'
  | 'inhaler'
  | 'liquid'
  | 'other'
export type LoopType = 'referral' | 'test' | 'letter' | 'follow_up' | 'other'
export type LoopState = 'waiting' | 'done' | 'overdue'
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
