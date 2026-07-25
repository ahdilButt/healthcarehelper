import { NextResponse } from 'next/server'
import { after } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { DOCUMENTS_BUCKET } from '@/lib/constants'
import { runPipeline } from '@/lib/ingest/pipeline'
import type { DocumentKind } from '@/lib/types'

const KINDS: DocumentKind[] = ['letter_photo', 'pdf', 'voice_note', 'box_photo']
const MAX_BYTES = 30 * 1024 * 1024

/**
 * POST /api/documents — the camera's landing point.
 *
 * Stores the original in the private bucket, creates the row, and returns
 * immediately with status 'processing' so the card can appear at once. The
 * two-stage pipeline then runs via `after()`, which lets the response flush
 * first but keeps the work inside the same serverless invocation.
 */
export const POST = route(async (req: Request) => {
  const form = await req.formData().catch(() => null)
  if (!form) throw new ApiError('invalid_input', 'Expected a multipart upload.')

  const personId = String(form.get('personId') ?? '')
  if (!personId) throw new ApiError('invalid_input', 'Missing personId.')

  const member = await requireMember(personId)

  const kind = String(form.get('kind') ?? 'letter_photo') as DocumentKind
  if (!KINDS.includes(kind)) throw new ApiError('invalid_input', `Unknown kind: ${kind}`)

  const file = (form.get('file') ?? form.get('audio')) as File | null
  if (!file || typeof file === 'string') throw new ApiError('invalid_input', 'No file uploaded.')
  if (file.size === 0) throw new ApiError('invalid_input', 'That file is empty.')
  if (file.size > MAX_BYTES) throw new ApiError('invalid_input', 'That file is too large (30MB max).')

  // Voice notes carry a transcript captured on-device while recording.
  const hintedTranscript = form.get('transcript') ? String(form.get('transcript')) : null

  const { data: doc, error } = await member.db
    .from('documents')
    .insert({
      person_id: personId,
      kind,
      storage_path: 'pending',
      status: 'processing',
      created_by: member.userId,
    })
    .select('id')
    .single()
  if (error || !doc) throw new ApiError('processing_failed', 'Could not start that upload.')

  const safeName = (file.name || 'document').replace(/[^\w.\-]/g, '_').slice(-80)
  const storagePath = `${personId}/${doc.id}/${safeName}`

  const { error: upErr } = await member.db.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })
  if (upErr) {
    await member.db.from('documents').update({ status: 'needs_look' }).eq('id', doc.id)
    throw new ApiError('processing_failed', 'Could not store that file.')
  }

  await member.db.from('documents').update({ storage_path: storagePath }).eq('id', doc.id)

  after(async () => {
    await runPipeline(member.db, doc.id, { hintedTranscript })
  })

  return NextResponse.json({ documentId: doc.id, status: 'processing' })
})
