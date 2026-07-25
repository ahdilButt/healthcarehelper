import type { SupabaseClient } from '@supabase/supabase-js'
import { DOCUMENTS_BUCKET } from '@/lib/constants'
import { transcribe } from './stage-a'
import { extractFacts } from './stage-b'
import { writeFacts } from './write-facts'
import { narrationOf } from './schema'
import { RefusalError } from '@/lib/ai/claude'

/**
 * Storage -> Stage A -> Stage B -> facts.
 *
 * Runs after the upload response has been sent, updating the document row as
 * it goes so the processing card can narrate real progress (SPEC-FINAL §3:
 * "Reading the letter… found 3 medications"). Every exit path leaves the
 * document in a terminal state — it must never be stuck on "processing".
 *
 * Duplicates are NOT resolved here. Facts are always written; the merge prompt
 * is computed on read and the merge routine suppresses the loser's facts. That
 * keeps the pipeline stateless, which matters because it runs in a serverless
 * function that may not be the one that answers the next request.
 */
export async function runPipeline(
  db: SupabaseClient,
  documentId: string,
  opts: { hintedTranscript?: string | null } = {}
): Promise<void> {
  const { data: doc } = await db
    .from('documents')
    .select('id, person_id, storage_path, kind')
    .eq('id', documentId)
    .single()
  if (!doc) return

  try {
    const { data: file, error: dlErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .download(doc.storage_path)
    if (dlErr || !file) throw new Error(`download failed: ${dlErr?.message}`)

    const bytes = new Uint8Array(await file.arrayBuffer())
    const filename = doc.storage_path.split('/').pop() ?? 'document'

    // ---- Stage A: transcribe
    const stageA = await transcribe(bytes, filename, { hintedTranscript: opts.hintedTranscript })
    if (!stageA.readable) {
      // "Needs a look" — show the photo, plain words, retake or type it in.
      await db
        .from('documents')
        .update({ status: 'needs_look', transcript: stageA.transcript || null })
        .eq('id', documentId)
      return
    }
    await db.from('documents').update({ transcript: stageA.transcript }).eq('id', documentId)

    // ---- Stage B: extract
    const facts = await extractFacts(stageA.transcript, stageA.legibility)

    await db
      .from('documents')
      .update({
        doc_type: facts.doc_meta.type,
        doc_date: facts.doc_meta.date,
        sender: facts.doc_meta.sender,
      })
      .eq('id', documentId)

    await writeFacts(db, doc.person_id, documentId, facts)
    await db.from('documents').update({ status: 'ready' }).eq('id', documentId)
  } catch (e) {
    const reason =
      e instanceof RefusalError
        ? 'the assistant declined to read this document'
        : e instanceof Error
          ? e.message
          : 'unknown error'
    // No PII in logs (BUILD-GUIDE §4) — the id and the reason, nothing else.
    console.error(`[pipeline] ${documentId}: ${reason}`)
    await db.from('documents').update({ status: 'needs_look' }).eq('id', documentId)
  }
}

export { narrationOf }
