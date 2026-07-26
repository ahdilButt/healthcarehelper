import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { RefusalError } from '@/lib/ai/claude'
import { applyCorrections, latestCorrections } from '@/lib/facts/read'
import { sourceLabel } from '@/lib/timeline/build'
import { draftChase } from '@/lib/ask/chase'
import { BudgetError, chargeUserCall } from '@/lib/usage/meter'

/**
 * GET /api/loops/:id/chase — the drafted letter behind a watch-card.
 *
 * Not in the frozen contract: an addition, no existing signature moves. The
 * capability is core (SPEC-FINAL §4 and §10), it just had no route named for it.
 */
export const GET = route(async (_req: Request, ctx: RouteContext<'/api/loops/[id]/chase'>) => {
  const { id } = await ctx.params
  const { membership, row } = await requireMemberOfRow('open_loops', id)
  await chargeUserCall(membership.userId)
  const db = membership.db

  const fixes = await latestCorrections(db, 'open_loops', id)
  const loop = applyCorrections(row, fixes)

  const { data: doc } = await db
    .from('documents')
    .select('id, doc_type, sender, doc_date, transcript')
    .eq('id', String(row.source_document_id))
    .maybeSingle()

  const transcript = ((doc?.transcript as string | null) ?? '').trim()
  if (!transcript) {
    throw new ApiError(
      'invalid_input',
      'We cannot draft this one — the letter it came from has no readable text.'
    )
  }

  const { data: person } = await db
    .from('persons')
    .select('display_name')
    .eq('id', membership.personId)
    .maybeSingle()

  const expected = (loop.expected_date as string | null) ?? null
  const daysOverdue = expected
    ? Math.floor((Date.now() - new Date(`${expected}T00:00:00Z`).getTime()) / 86400000)
    : null

  try {
    const draft = await draftChase({
      description: String(loop.description ?? ''),
      expectedDate: expected,
      daysOverdue,
      // The letter is signed by whoever is chasing, not by the app. There is
      // no name on a magic-link sign-in, so their address is the best we have —
      // and the draft is theirs to edit before it goes anywhere.
      writerName: nameFromEmail(membership.email),
      personName: person?.display_name ?? 'the patient',
      sourceTranscript: transcript,
      sourceLabel: sourceLabel(doc ?? undefined),
    })
    return NextResponse.json(draft)
  } catch (e) {
    if (e instanceof BudgetError) throw e
    if (e instanceof RefusalError) {
      throw new ApiError('processing_failed', 'We could not draft that one.')
    }
    console.error('[chase] failed', e instanceof Error ? e.message : e)
    throw new ApiError('processing_failed', 'We could not draft that one just now.')
  }
})

function nameFromEmail(email: string | null): string {
  const local = email?.split('@')[0]?.replace(/[._-]+/g, ' ').trim()
  if (!local) return 'the family'
  return local.replace(/\b[a-z]/g, (c) => c.toUpperCase())
}
