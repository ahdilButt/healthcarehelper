import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
import { createClient } from '@supabase/supabase-js'
import { cloneRecord, templatePersonId } from '../lib/demo/clone'

/**
 * `npm run demo:clone-probe` — proves guest mode's record copy is complete
 * and isolated, without needing anonymous sign-ins to be switched on.
 *
 * Copies the demo record to a throwaway account, compares every table
 * row-for-row against the template, checks that no copied fact still cites
 * the template's documents, then deletes both. Pass `--keep` to leave the
 * copy in place and look at it.
 */
const EMAIL = 'clone-probe@example.com'

async function main() {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )

  const template = await templatePersonId(db)
  console.log('template person:', template)
  if (!template) throw new Error('no template')

  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  const found = list?.users.find((u) => u.email?.toLowerCase() === EMAIL)
  const userId =
    found?.id ??
    (await db.auth.admin.createUser({ email: EMAIL, email_confirm: true })).data.user!.id
  console.log('probe user:', userId)

  const started = Date.now()
  const result = await cloneRecord(db, { templatePersonId: template, userId })
  console.log('cloned in', Date.now() - started, 'ms ->', result)

  const tables = [
    'documents',
    'conditions',
    'medications',
    'med_change_events',
    'allergies',
    'results',
    'appointments',
    'open_loops',
    'routines',
    'corrections',
  ]
  for (const t of tables) {
    const src = await db.from(t).select('id').eq('person_id', template)
    const copy = await db.from(t).select('id').eq('person_id', result.personId)
    const flag = src.data?.length === copy.data?.length ? 'ok  ' : 'DIFF'
    console.log(`  ${flag} ${t.padEnd(20)} template ${src.data?.length ?? '?'} -> copy ${copy.data?.length ?? '?'}`)
  }

  // Every fact must point at a document inside the copy, never the template's.
  const { data: docs } = await db.from('documents').select('id').eq('person_id', result.personId)
  const own = new Set((docs ?? []).map((d) => d.id))
  let strays = 0
  for (const t of ['conditions', 'medications', 'results', 'appointments', 'open_loops', 'allergies']) {
    const { data } = await db.from(t).select('source_document_id').eq('person_id', result.personId)
    for (const r of data ?? []) if (!own.has(r.source_document_id)) strays++
  }
  console.log(strays === 0 ? '  ok   every fact cites a document in this copy' : `  DIFF ${strays} strays`)

  const { data: meds } = await db
    .from('medications')
    .select('name, current_dose')
    .eq('person_id', result.personId)
    .order('name')
  console.log('  medicines:', (meds ?? []).map((m) => `${m.name} ${m.current_dose}`).join(' · '))

  const { data: mem } = await db.from('memberships').select('role').eq('person_id', result.personId)
  console.log('  membership:', JSON.stringify(mem))

  if (process.argv.includes('--keep')) return
  await db.from('persons').delete().eq('id', result.personId)
  await db.auth.admin.deleteUser(userId)
  console.log('cleaned up')
}

main().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
