import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Gentle duplicate detection (SPEC-FINAL §3).
 *
 * Two photographs of the same letter must not silently become two entries in
 * someone's medical history. A probable duplicate is the same date + sender +
 * type, or a near-identical transcript — the user is then ASKED, and the
 * default is merge.
 */

export interface DuplicateCandidate {
  documentId: string
  reason: 'same_letter' | 'near_identical_text'
  similarity: number
}

/** Word-level Jaccard: cheap, order-insensitive, and stable under OCR wobble. */
export function textSimilarity(a: string, b: string): number {
  const tokens = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length > 3)
    )
  const ta = tokens(a)
  const tb = tokens(b)
  if (!ta.size || !tb.size) return 0
  let shared = 0
  for (const t of ta) if (tb.has(t)) shared++
  return shared / (ta.size + tb.size - shared)
}

export const NEAR_IDENTICAL = 0.72

export async function findDuplicate(
  db: SupabaseClient,
  personId: string,
  candidate: { id: string; docDate: string | null; sender: string | null; docType: string | null; transcript: string }
): Promise<DuplicateCandidate | null> {
  const { data: others } = await db
    .from('documents')
    .select('id, doc_date, sender, doc_type, transcript')
    .eq('person_id', personId)
    .neq('id', candidate.id)
    .neq('status', 'merged')
    .order('created_at', { ascending: false })
    .limit(60)

  let best: DuplicateCandidate | null = null

  for (const other of others ?? []) {
    // Same letter, arriving twice: date + sender + type all agree.
    if (
      candidate.docDate &&
      other.doc_date === candidate.docDate &&
      candidate.docType &&
      other.doc_type === candidate.docType &&
      sameSender(other.sender, candidate.sender)
    ) {
      return { documentId: other.id, reason: 'same_letter', similarity: 1 }
    }

    if (other.transcript && candidate.transcript) {
      const sim = textSimilarity(other.transcript, candidate.transcript)
      if (sim >= NEAR_IDENTICAL && (!best || sim > best.similarity)) {
        best = { documentId: other.id, reason: 'near_identical_text', similarity: sim }
      }
    }
  }

  return best
}

function sameSender(a: string | null, b: string | null): boolean {
  if (!a || !b) return false
  const n = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  const x = n(a)
  const y = n(b)
  return x === y || x.includes(y) || y.includes(x)
}
