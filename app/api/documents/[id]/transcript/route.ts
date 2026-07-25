import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireMemberOfRow } from '@/lib/api/guards'
import { runPipeline } from '@/lib/ingest/pipeline'

const MIN_LENGTH = 20
const MAX_LENGTH = 40000

/**
 * POST /api/documents/:id/transcript — "type what it says", the way out of a
 * Needs-a-look card when the photograph will never be readable.
 *
 * The typed words become the transcript, so the rest of the pipeline is
 * unchanged: Stage A is skipped via the hinted transcript and Stage B reads the
 * human's text exactly as it would have read the machine's.
 */
export const POST = route(async (req: Request, ctx: RouteContext<'/api/documents/[id]/transcript'>) => {
  const { id } = await ctx.params

  const body = await readJson<{ transcript?: string }>(req)
  const transcript = String(required(body.transcript, 'transcript')).trim()
  if (transcript.length < MIN_LENGTH) {
    throw new ApiError('invalid_input', 'Type a little more of what the letter says.')
  }
  if (transcript.length > MAX_LENGTH) {
    throw new ApiError('invalid_input', 'That is longer than one letter — add it as separate letters.')
  }

  const { membership } = await requireMemberOfRow('documents', id)
  const db = membership.db

  // The status change IS the lock. Only a document that never got read may be
  // re-read, and only once: writeFacts inserts results, appointments and loops
  // unconditionally, so a second run — a retried tap after a dropped response,
  // or two carers answering the same card — would double every one of them.
  const { data: claimed, error } = await db
    .from('documents')
    .update({ transcript, status: 'processing' })
    .eq('id', id)
    .eq('status', 'needs_look')
    .select('id')
  if (error) throw new ApiError('processing_failed', 'Could not save that.')
  if (!claimed?.length) {
    throw new ApiError('invalid_input', 'This one is already being read. Give it a moment.')
  }

  after(async () => {
    await runPipeline(db, id, { hintedTranscript: transcript })
  })

  return NextResponse.json({ status: 'processing' })
})
