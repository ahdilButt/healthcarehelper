import { z } from 'zod'

/**
 * The single fact shape in the system.
 *
 * Stage B (Claude) emits it, and the seed script emits it from the curator's
 * fixtures. One writer persists it. That is the "no collision" trick from
 * BUILD-GUIDE §1 — unplug the seed, ingest live, nothing downstream changes.
 */

const conf = z.number().min(0).max(1)

export const MED_FORMS = [
  'tablet',
  'capsule',
  'patch',
  'gel',
  'injection',
  'inhaler',
  'liquid',
  'other',
] as const

export const LOOP_TYPES = ['referral', 'test', 'letter', 'follow_up', 'other'] as const

export const docMetaSchema = z.object({
  type: z.string(),
  date: z.string().nullable(),
  sender: z.string().nullable(),
  human_title: z.string(),
})

export const extractedFactsSchema = z.object({
  doc_meta: docMetaSchema,
  conditions: z
    .array(
      z.object({
        name: z.string(),
        status: z.string().default('active'),
        confidence: conf,
      })
    )
    .default([]),
  medications: z
    .array(
      z.object({
        name: z.string(),
        current_dose: z.string(),
        form: z.enum(MED_FORMS).default('tablet'),
        schedule_hint: z.string().nullable().default(null),
        rotation_sites: z.array(z.string()).nullable().default(null),
        is_active: z.boolean().default(true),
        /** Present when this document itself records a dose change. */
        change: z.object({ old_dose: z.string().nullable() }).nullable().default(null),
        confidence: conf,
      })
    )
    .default([]),
  allergies: z
    .array(
      z.object({
        substance: z.string(),
        reaction: z.string().nullable().default(null),
        confidence: conf,
      })
    )
    .default([]),
  results: z
    .array(
      z.object({
        name: z.string(),
        value: z.number().nullable().default(null),
        value_text: z.string().nullable().default(null),
        unit: z.string().nullable().default(null),
        ref_low: z.number().nullable().default(null),
        ref_high: z.number().nullable().default(null),
        /** true ONLY when the document itself flags it out of range. */
        flagged: z.boolean().default(false),
        result_date: z.string().nullable().default(null),
        confidence: conf,
      })
    )
    .default([]),
  appointments: z
    .array(
      z.object({
        title: z.string(),
        location: z.string().nullable().default(null),
        starts_at: z.string().nullable().default(null),
        confidence: conf,
      })
    )
    .default([]),
  open_loops: z
    .array(
      z.object({
        loop_type: z.enum(LOOP_TYPES),
        description: z.string(),
        expected_date: z.string().nullable().default(null),
        confidence: conf,
      })
    )
    .default([]),
})

export type ExtractedFacts = z.infer<typeof extractedFactsSchema>
export type DocMeta = z.infer<typeof docMetaSchema>

/** Counts for the live-narration card ("found 3 medications · 1 result · 1 thing to watch"). */
export interface Narration {
  medications: number
  results: number
  loops: number
  conditions: number
  allergies: number
  appointments: number
}

export function narrationOf(f: ExtractedFacts): Narration {
  return {
    medications: f.medications.length,
    results: f.results.length,
    loops: f.open_loops.length,
    conditions: f.conditions.length,
    allergies: f.allergies.length,
    appointments: f.appointments.length,
  }
}

/**
 * JSON Schema handed to Claude via output_config.format. Written by hand rather
 * than generated so the wire contract can't shift under a zod upgrade.
 * Structured outputs require additionalProperties:false and explicit required.
 */
export const EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'doc_meta',
    'conditions',
    'medications',
    'allergies',
    'results',
    'appointments',
    'open_loops',
  ],
  properties: {
    doc_meta: {
      type: 'object',
      additionalProperties: false,
      required: ['type', 'date', 'sender', 'human_title'],
      properties: {
        type: {
          type: 'string',
          description:
            'One of: clinic_letter, discharge_summary, blood_panel, imaging_report, referral_letter, medication_review, appointment_letter, screening_invite, admin_letter, voice_note, medicine_box, pharmacy_slip, other',
        },
        date: { type: ['string', 'null'], description: 'The document date, YYYY-MM-DD.' },
        sender: { type: ['string', 'null'], description: 'Who wrote it, e.g. "Cardiology, St Saviour\'s NHS Trust".' },
        human_title: {
          type: 'string',
          description:
            'What a family member would call this, in plain warm English. "Heart clinic letter", not "Cardiology outpatient correspondence".',
        },
      },
    },
    conditions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'status', 'confidence'],
        properties: {
          name: { type: 'string' },
          status: { type: 'string', description: '"active" or "resolved"' },
          confidence: { type: 'number' },
        },
      },
    },
    medications: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'current_dose',
          'form',
          'schedule_hint',
          'rotation_sites',
          'is_active',
          'change',
          'confidence',
        ],
        properties: {
          name: { type: 'string' },
          current_dose: { type: 'string', description: 'e.g. "5mg once daily"' },
          form: { type: 'string', enum: [...MED_FORMS] },
          schedule_hint: { type: ['string', 'null'], description: 'Free text about when/how to take it.' },
          rotation_sites: {
            type: ['array', 'null'],
            items: { type: 'string' },
            description: 'For patches/gels only, e.g. ["left hip","right hip"].',
          },
          is_active: { type: 'boolean', description: 'false if this document STOPS the medicine.' },
          change: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['old_dose'],
            properties: { old_dose: { type: ['string', 'null'] } },
            description: 'Only when this document records a dose change.',
          },
          confidence: { type: 'number' },
        },
      },
    },
    allergies: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['substance', 'reaction', 'confidence'],
        properties: {
          substance: { type: 'string' },
          reaction: { type: ['string', 'null'] },
          confidence: { type: 'number' },
        },
      },
    },
    results: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'value',
          'value_text',
          'unit',
          'ref_low',
          'ref_high',
          'flagged',
          'result_date',
          'confidence',
        ],
        properties: {
          name: { type: 'string' },
          value: { type: ['number', 'null'], description: 'Numeric results only.' },
          value_text: { type: ['string', 'null'], description: 'Non-numeric results, e.g. "no acute changes".' },
          unit: { type: ['string', 'null'] },
          ref_low: { type: ['number', 'null'] },
          ref_high: { type: ['number', 'null'] },
          flagged: {
            type: 'boolean',
            description: 'true ONLY if the document itself marks it abnormal. Never infer.',
          },
          result_date: { type: ['string', 'null'], description: 'When the sample was taken, YYYY-MM-DD.' },
          confidence: { type: 'number' },
        },
      },
    },
    appointments: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'location', 'starts_at', 'confidence'],
        properties: {
          title: { type: 'string' },
          location: { type: ['string', 'null'] },
          starts_at: { type: ['string', 'null'], description: 'ISO-8601 if a date AND time are given.' },
          confidence: { type: 'number' },
        },
      },
    },
    open_loops: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['loop_type', 'description', 'expected_date', 'confidence'],
        properties: {
          loop_type: { type: 'string', enum: [...LOOP_TYPES] },
          description: { type: 'string' },
          expected_date: { type: ['string', 'null'], description: 'When it should have happened, YYYY-MM-DD.' },
          confidence: { type: 'number' },
        },
      },
    },
  },
} as const
