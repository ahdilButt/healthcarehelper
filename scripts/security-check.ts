import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

/**
 * The BUILD-GUIDE §4 checklist, run rather than asserted.
 *
 * Everything here is read-only and safe to run against a live database. It
 * signs in as nobody — the anon key, exactly what a stranger with the public
 * config has — and tries to read the record.
 *
 *   npm run security-check            # anon + bundle checks
 *   npm run security-check -- <url>   # also probes a running app
 */

const TABLES = [
  'persons',
  'memberships',
  'invites',
  'documents',
  'conditions',
  'medications',
  'med_change_events',
  'allergies',
  'results',
  'appointments',
  'open_loops',
  'corrections',
  'routines',
  'taken_events',
  'capsules',
  'capsule_views',
  'conversations',
  'messages',
  'notifications',
]

let failures = 0

const pass = (label: string, detail = '') => console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
const fail = (label: string, detail = '') => {
  failures++
  console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
}

async function anonChecks() {
  console.log('\nAnonymous reads (the anon key must see nothing)')
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    { auth: { persistSession: false } }
  )

  let leaked = 0
  for (const table of TABLES) {
    const { data, error } = await anon.from(table).select('*').limit(1)
    if (error) continue // RLS refusing outright is the strongest answer
    if ((data ?? []).length > 0) {
      fail(`${table} readable by anon`, `${data!.length} row(s)`)
      leaked++
    }
  }
  if (!leaked) pass('every table', `${TABLES.length} tables return nothing to anon`)

  console.log('\nStorage')
  const { data: buckets } = await anon.storage.listBuckets()
  const documents = (buckets ?? []).find((b) => b.name === 'documents')
  if (!documents) pass('documents bucket', 'not even listable anonymously')
  else if (documents.public) fail('documents bucket is PUBLIC')
  else pass('documents bucket is private')

  const service = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  )
  const { data: doc } = await service
    .from('documents')
    .select('storage_path')
    .not('storage_path', 'eq', 'pending')
    .limit(1)
    .maybeSingle()

  if (doc?.storage_path) {
    const { data: file } = await anon.storage.from('documents').download(doc.storage_path as string)
    if (file) fail('an original document downloaded anonymously')
    else pass('originals need a signed URL', 'anon download refused')
  }

  console.log('\nCapsule tokens')
  const { data: capsules } = await service.from('capsules').select('token').limit(20)
  const short = (capsules ?? []).filter((c) => String(c.token).length < 22)
  if (short.length) fail('capsule token too short', `${short.length} under 128 bits`)
  else pass('capsule tokens', `${(capsules ?? []).length} checked, all >= 128 bits`)

  console.log('\nInvites')
  const { data: invites } = await service.from('invites').select('token, expires_at, used_at').limit(20)
  const noExpiry = (invites ?? []).filter((i) => !i.expires_at)
  if (noExpiry.length) fail('invite without an expiry', `${noExpiry.length}`)
  else pass('invites', `${(invites ?? []).length} checked, all carry an expiry`)
}

async function appChecks(base: string) {
  console.log(`\nRunning app at ${base}`)

  const noSecret = await fetch(`${base}/api/cron/tick`, { method: 'POST' })
  noSecret.status === 401
    ? pass('cron tick without the secret', '401')
    : fail('cron tick without the secret', `got ${noSecret.status}`)

  const badSecret = await fetch(`${base}/api/cron/tick`, {
    method: 'POST',
    headers: { 'x-cron-secret': 'not-the-secret' },
  })
  badSecret.status === 401
    ? pass('cron tick with a wrong secret', '401')
    : fail('cron tick with a wrong secret', `got ${badSecret.status}`)

  const webhook = await fetch(`${base}/api/webhooks/twilio-status`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', 'x-twilio-signature': 'nope' },
    body: 'MessageSid=SM1&MessageStatus=delivered',
  })
  webhook.status === 401
    ? pass('twilio webhook with a bad signature', '401')
    : fail('twilio webhook with a bad signature', `got ${webhook.status}`)

  const capsule = await fetch(`${base}/c/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`, { redirect: 'follow' })
  capsule.status === 404
    ? pass('invented capsule token', '404')
    : fail('invented capsule token', `got ${capsule.status}`)

  const timeline = await fetch(`${base}/api/persons/00000000-0000-0000-0000-000000000000/timeline`)
  timeline.status === 401 || timeline.status === 403
    ? pass('another person’s timeline without a session', String(timeline.status))
    : fail('another person’s timeline without a session', `got ${timeline.status}`)

  const documents = await fetch(`${base}/api/documents`, { method: 'POST', body: new FormData() })
  documents.status === 400 || documents.status === 401
    ? pass('upload without a session', String(documents.status))
    : fail('upload without a session', `got ${documents.status}`)
}

async function main() {
  console.log('HealthcareHelper — security checklist (BUILD-GUIDE §4)')
  await anonChecks()

  const base = process.argv[2]
  if (base) await appChecks(base.replace(/\/$/, ''))
  else console.log('\n(Pass a base URL to also probe a running app.)')

  console.log(failures === 0 ? '\nALL CHECKS PASS' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
