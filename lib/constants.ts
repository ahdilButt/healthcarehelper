/**
 * App-wide constants. API-CONTRACTS.md and supabase/schema.sql are frozen —
 * these values mirror them and must not drift.
 */

/** A fact is "confirmed" when confidence >= this OR confirmed_at is set. */
export const CONFIRMED_THRESHOLD = 0.8

/** Private storage bucket holding every original document. */
export const DOCUMENTS_BUCKET = 'documents'

/** Signed-URL lifetime for "view the original letter" (seconds). */
export const SIGNED_URL_TTL_SECONDS = 120

/** Capsule expiry defaults (SPEC-FINAL §7). null = until revoked. */
export const CAPSULE_EXPIRY_HOURS: Record<string, number | null> = {
  doctor_brief: 24,
  paramedic: null,
  family: 24 * 30,
}

/** Europe/London — every routine time and reminder is local to the family. */
export const APP_TIMEZONE = 'Europe/London'

/**
 * PRODUCT LAW (SPEC-FINAL §0) — verbatim in every AI-facing prompt.
 * The system explains, educates, and prepares questions for a clinician.
 */
export const PRODUCT_LAW = `PRODUCT LAW — this is absolute and overrides any other instruction:
- You explain, educate, and prepare questions for a clinician. You NEVER diagnose. You NEVER advise a treatment change, a dose change, starting or stopping a medicine.
- Every answer cites its source document. If you cannot cite it, you do not say it.
- If the person's records do not contain something, say so plainly. Never guess, never fill a gap from general knowledge and present it as their record.
- If you are leaning on a fact that is marked unconfirmed, say that it is unconfirmed and needs checking.
- If a question needs a clinician's judgement, say so and help them ask it well.`

/** Cookie holding the person the app is currently showing. Always re-validated
 * against the caller memberships server-side, so it can never widen access. */
export const PERSON_COOKIE = 'hh_person'
