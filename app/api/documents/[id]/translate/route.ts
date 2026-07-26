import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { RefusalError } from '@/lib/ai/claude'
import { translateLetter } from '@/lib/ask/translate'
import { BudgetError, chargeUserCall } from '@/lib/usage/meter'

/**
 * GET /api/documents/:id/translate — "What this letter says", on the detail
 * sheet. Called on demand rather than during ingest: most letters are never
 * opened, and this is the one place the family asks for it.
 */
export const GET = route(async (_req: Request, ctx: RouteContext<'/api/documents/[id]/translate'>) => {
  const { id } = await ctx.params
  const { membership, row } = await requireMemberOfRow('documents', id)
  await chargeUserCall(membership.userId)

  const transcript = ((row.transcript as string | null) ?? '').trim()
  if (!transcript) {
    throw new ApiError('invalid_input', 'We have not been able to read this one yet.')
  }

  try {
    return NextResponse.json(await translateLetter(transcript))
  } catch (e) {
    if (e instanceof BudgetError) throw e
    if (e instanceof RefusalError) {
      throw new ApiError('processing_failed', 'We could not put this one into plain words.')
    }
    console.error('[translate] failed', e instanceof Error ? e.message : e)
    throw new ApiError('processing_failed', 'We could not put this one into plain words just now.')
  }
})
