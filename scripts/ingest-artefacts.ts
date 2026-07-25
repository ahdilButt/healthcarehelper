import { config } from 'dotenv'
config({ path: '.env.local' })

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { putDocument } from '../lib/storage'
import { runPipeline } from '../lib/ingest/pipeline'
import type { DocumentKind } from '../lib/types'

/**
 * The M3 unplug (BUILD-GUIDE §3): the demo artefacts through the real pipeline,
 * with no seed anywhere near them.
 *
 * Same storage, same two Claude stages, same writeFacts as the upload route —
 * the only thing it skips is the HTTP session, because a script has no cookie.
 * Prove the route separately by photographing one letter through the app.
 *
 * ORDER MATTERS, which is why it is by document date rather than by filename.
 * Ingesting the 12 May letter before the February one would record Ramipril
 * going from 5mg to 2.5mg — a dose reduction that never happened.
 *
 *   npm run ingest              # every artefact
 *   npm run ingest -- 01 02 08  # a subset, by id
 */

const DOCS = 'demo-data/docs'
const SOURCE = 'demo-data/source'

const KIND: Record<string, DocumentKind> = {
  '11': 'voice_note',
  '12': 'box_photo',
  '12b': 'letter_photo',
  S2: 'letter_photo',
}

const MEDIA: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.txt': 'text/plain',
}

interface Artefact {
  id: string
  date: string
  file: string
}

function artefacts(): Artefact[] {
  const files = readdirSync(DOCS)
  const out: Artefact[] = []
  for (const name of readdirSync(SOURCE)) {
    const spec = JSON.parse(readFileSync(join(SOURCE, name), 'utf8')) as {
      id: string
      slug: string
      meta?: { date?: string }
    }
    const file = files.find((f) => f.includes(spec.slug))
    if (!file) {
      console.log(`  (no artefact rendered for ${spec.id} — skipping)`)
      continue
    }
    out.push({ id: spec.id, date: spec.meta?.date ?? '9999-12-31', file })
  }
  // The duplicate goes last, whatever its date: it is a second photograph of a
  // letter that must already be in the record for the merge prompt to mean
  // anything.
  return out.sort((a, b) =>
    a.id === '12b' ? 1 : b.id === '12b' ? -1 : a.date.localeCompare(b.date)
  )
}

async function main() {
  const only = process.argv.slice(2)
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  )

  const { data: persons } = await db.from('persons').select('id, display_name, created_by')
  const person = (persons ?? []).find((p) => p.display_name !== 'Amira') ?? (persons ?? [])[0]
  if (!person) throw new Error('No person yet — go through onboarding first.')
  console.log(`Ingesting into ${person.display_name}\n`)

  const list = artefacts().filter((a) => !only.length || only.includes(a.id))
  const started = Date.now()

  for (const [i, artefact] of list.entries()) {
    const label = `${String(i + 1).padStart(2)}/${list.length}  ${artefact.id.padEnd(4)} ${artefact.file}`
    const bytes = readFileSync(join(DOCS, artefact.file))
    const ext = artefact.file.slice(artefact.file.lastIndexOf('.')).toLowerCase()

    const { data: doc, error } = await db
      .from('documents')
      .insert({
        person_id: person.id,
        kind: KIND[artefact.id] ?? (ext === '.pdf' ? 'pdf' : 'letter_photo'),
        storage_path: 'pending',
        status: 'processing',
        created_by: person.created_by,
      })
      .select('id')
      .single()
    if (error || !doc) throw new Error(`${artefact.id}: ${error?.message}`)

    const path = `${person.id}/${doc.id}/${artefact.file}`
    const stored = await putDocument(
      db,
      path,
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      MEDIA[ext] ?? 'application/octet-stream'
    )
    if (!stored.ok) throw new Error(`${artefact.id}: ${stored.reason}`)
    await db.from('documents').update({ storage_path: path }).eq('id', doc.id)

    const at = Date.now()
    await runPipeline(db, doc.id, { storage: db })
    const { data: after } = await db
      .from('documents')
      .select('status, doc_type, doc_date')
      .eq('id', doc.id)
      .single()

    console.log(
      `${label}  ->  ${String(after?.status).padEnd(10)} ${after?.doc_type ?? ''} ${after?.doc_date ?? ''}  (${Math.round((Date.now() - at) / 1000)}s)`
    )
  }

  console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
