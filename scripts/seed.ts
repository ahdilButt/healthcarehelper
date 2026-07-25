import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { artefactFilename, artefactKind, artefactTranscript, type Artefact } from '../lib/demo/artefact'
import { writeFacts } from '../lib/ingest/write-facts'
import { fixtureToFacts, type Fixture } from '../lib/demo/fixture'
import { DOCUMENTS_BUCKET } from '../lib/constants'

/**
 * Loads the curated demo record straight into the tables — no AI, no cost.
 *
 * BUILD-GUIDE §1 calls this sacred: every data-out feature (Ask, Today,
 * capsules, watch-cards) develops against a full realistic record without
 * waiting on the ingest pipeline. `npm run seed:reset` wipes first.
 */

const SRC = path.join(process.cwd(), 'demo-data', 'source')
const FIX = path.join(process.cwd(), 'demo-data', 'fixtures')
const DOCS = path.join(process.cwd(), 'demo-data', 'docs')

const AMIRA_EMAIL = process.env.SEED_OWNER_EMAIL ?? 'amira@example.com'
const DAD_EMAIL = process.env.SEED_PATIENT_EMAIL ?? 'dad@example.com'

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.txt': 'text/plain',
}

async function ensureUser(db: SupabaseClient, email: string): Promise<string> {
  // listUsers is paginated; the demo has two users so one page is plenty.
  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (found) return found.id
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true })
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`)
  return data.user.id
}

async function main() {
  const reset = process.argv.includes('--reset')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const amiraId = await ensureUser(db, AMIRA_EMAIL)
  const dadUserId = await ensureUser(db, DAD_EMAIL)
  console.log(`users: owner=${AMIRA_EMAIL} patient=${DAD_EMAIL}`)

  // ---- person: Dad
  let personId: string
  // Oldest wins, so a re-run always targets the same record rather than
  // silently creating a second "Dad".
  const { data: dadRows } = await db
    .from('persons')
    .select('id')
    .eq('display_name', 'Dad')
    .eq('created_by', amiraId)
    .order('created_at', { ascending: true })
  const existingPerson = dadRows?.[0] ?? null

  if (existingPerson && reset) {
    console.log('reset: clearing Dad’s record...')
    personId = existingPerson.id
    // Children first; documents last because facts reference them.
    for (const t of [
      'taken_events',
      'routines',
      'notifications',
      'messages',
      'conversations',
      'capsule_views',
      'capsules',
      'corrections',
      'med_change_events',
      'medications',
      'conditions',
      'allergies',
      'results',
      'appointments',
      'open_loops',
    ]) {
      if (t === 'messages') {
        await db.from('messages').delete().in(
          'conversation_id',
          ((await db.from('conversations').select('id').eq('person_id', personId)).data ?? []).map((c) => c.id)
        )
        continue
      }
      if (t === 'capsule_views') {
        await db.from('capsule_views').delete().in(
          'capsule_id',
          ((await db.from('capsules').select('id').eq('person_id', personId)).data ?? []).map((c) => c.id)
        )
        continue
      }
      const { error } = await db.from(t).delete().eq('person_id', personId)
      if (error) throw new Error(`reset ${t}: ${error.message}`)
    }
    await db.from('documents').delete().eq('person_id', personId)
    await db.storage.from(DOCUMENTS_BUCKET).remove(
      ((await db.storage.from(DOCUMENTS_BUCKET).list(personId, { limit: 1000 })).data ?? []).map(
        (f) => `${personId}/${f.name}`
      )
    )
  } else if (existingPerson) {
    personId = existingPerson.id
    console.log('person "Dad" already exists — re-run with --reset to rebuild')
    return
  } else {
    const { data, error } = await db
      .from('persons')
      .insert({
        display_name: 'Dad',
        managing_note: 'Heart failure, type 2 diabetes and kidney disease',
        emergency_contact: { name: 'Amira Adeyemi', phone: '07700 900412', relationship: 'Daughter' },
        dnr_status: null,
        created_by: amiraId,
      })
      .select('id')
      .single()
    if (error) throw new Error(`persons: ${error.message}`)
    personId = data.id
  }

  // ---- Amira's own (empty) record, so the person switcher has two entries
  const { data: amiraRows } = await db
    .from('persons')
    .select('id')
    .eq('display_name', 'Amira')
    .eq('created_by', amiraId)
    .order('created_at', { ascending: true })
  let amiraPersonId = amiraRows?.[0]?.id
  if (!amiraPersonId) {
    const { data } = await db
      .from('persons')
      .insert({ display_name: 'Amira', created_by: amiraId })
      .select('id')
      .single()
    amiraPersonId = data!.id
  }

  await db.from('memberships').upsert(
    [
      { user_id: amiraId, person_id: personId, role: 'owner' },
      { user_id: dadUserId, person_id: personId, role: 'patient' },
      { user_id: amiraId, person_id: amiraPersonId!, role: 'owner' },
    ],
    { onConflict: 'user_id,person_id' }
  )

  // ---- documents + facts, in date order so med changes land chronologically
  const specs: Artefact[] = []
  for (const f of (await readdir(SRC)).filter((f) => f.endsWith('.doc.json'))) {
    specs.push(JSON.parse(await readFile(path.join(SRC, f), 'utf8')))
  }
  // 12b is the duplicate photo — the merge flow creates it, not the seed.
  const ordered = specs
    .filter((a) => a.id !== '12b')
    .sort((a, b) => (a.meta?.date ?? '').localeCompare(b.meta?.date ?? ''))

  let totalFacts = 0
  for (const a of ordered) {
    const filename = artefactFilename(a)
    const bytes = await readFile(path.join(DOCS, filename))
    const ext = path.extname(filename)

    const { data: doc, error: docErr } = await db
      .from('documents')
      .insert({
        person_id: personId,
        kind: artefactKind(a),
        storage_path: 'pending',
        transcript: artefactTranscript(a),
        doc_type: a.docType,
        doc_date: a.meta?.date ?? null,
        sender: a.letterhead ? [a.letterhead.dept, a.letterhead.org].filter(Boolean).join(', ') : null,
        status: 'ready',
        created_by: amiraId,
      })
      .select('id')
      .single()
    if (docErr) throw new Error(`documents: ${docErr.message}`)

    const storagePath = `${personId}/${doc.id}/${filename}`
    const { error: upErr } = await db.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, bytes, { contentType: MIME[ext] ?? 'application/octet-stream', upsert: true })
    if (upErr) throw new Error(`storage ${filename}: ${upErr.message}`)
    await db.from('documents').update({ storage_path: storagePath }).eq('id', doc.id)

    const fixture: Fixture = JSON.parse(await readFile(path.join(FIX, `${a.id}.json`), 'utf8'))
    const facts = fixtureToFacts(fixture)
    const { counts } = await writeFacts(db, personId, doc.id, facts)
    const n = Object.values(counts).reduce((x, y) => x + y, 0)
    totalFacts += n
    console.log(`  ${a.id.padEnd(4)} ${a.humanTitle.padEnd(34)} ${n} facts`)
  }

  console.log(`\nSeeded person ${personId} — ${ordered.length} documents, ${totalFacts} facts.`)
  console.log(`Sign in as ${AMIRA_EMAIL} (magic link) to see it.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
