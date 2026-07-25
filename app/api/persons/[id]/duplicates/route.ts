import { NextResponse } from 'next/server'
import { route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { findDuplicate } from '@/lib/ingest/dedupe'
import { humanDocName, shortDate } from '@/lib/timeline/build'

/**
 * GET /api/persons/:id/duplicates — the merge prompts still owed to this
 * person.
 *
 * Whether two photographs of one letter have been reconciled is a property of
 * the record, not of the browser tab that happened to upload them. Computing it
 * here means the prompt survives a reload, a tab switch, and a phone handed to
 * someone else — SPEC-FINAL §3 asks that the same letter never silently become
 * two entries, and a prompt lost with the page would do exactly that.
 *
 * "Merged" and "keep both" both set merged_into, so an answered pair drops out
 * of this list on its own.
 */

const RECENT = 40

interface DocRow {
  id: string
  doc_date: string | null
  sender: string | null
  doc_type: string | null
  transcript: string | null
  created_at: string
}

export const GET = route(async (_req: Request, ctx: RouteContext<'/api/persons/[id]/duplicates'>) => {
  const { id } = await ctx.params
  const member = await requireMember(id)
  const db = member.db

  const { data } = await db
    .from('documents')
    .select('id, doc_date, sender, doc_type, transcript, created_at')
    .eq('person_id', id)
    .eq('status', 'ready')
    .is('merged_into', null)
    .order('created_at', { ascending: false })
    .limit(RECENT)

  const docs = (data ?? []) as DocRow[]
  const arrivedAt = new Map(docs.map((d) => [d.id, d.created_at]))
  const pairs: { documentId: string; duplicateOfId: string; label: string }[] = []
  const seen = new Set<string>()

  for (const d of docs) {
    const dup = await findDuplicate(db, id, {
      id: d.id,
      docDate: d.doc_date,
      sender: d.sender,
      docType: d.doc_type,
      transcript: d.transcript ?? '',
    })
    if (!dup) continue

    // Ask about the copy that arrived second: the older letter is the one the
    // story already tells, so it is the one worth keeping.
    const otherArrived = arrivedAt.get(dup.documentId)
    if (otherArrived && otherArrived > d.created_at) continue

    const key = [d.id, dup.documentId].sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)

    const other = docs.find((o) => o.id === dup.documentId)
    const what = humanDocName(other?.doc_type ?? null, other?.sender ?? null)
    const when = other?.doc_date ? shortDate(other.doc_date) : null
    pairs.push({
      documentId: d.id,
      duplicateOfId: dup.documentId,
      label: when ? `${what} from ${when}` : what,
    })
  }

  return NextResponse.json({ pairs })
})
