import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { USAGE, budgets, perUserKey } from '../lib/usage/meter'
import { demoWindow } from '../lib/demo/window'

/**
 * `npm run demo:check` — is the public demo actually fenced?
 *
 * Three things have to be true before a link goes out: the closing date is
 * set, the counter table exists, and the budgets are what you think they are.
 * The first and last are environment variables and lie quietly; the second is
 * a manual SQL paste, which is exactly the step that gets forgotten. This
 * prints all three and tells you what to do about the missing one.
 */

const money = (micros: number) => `$${(micros / 1_000_000).toFixed(2)}`

async function main() {
  const b = budgets()
  let failures = 0

  console.log('\n— Kill switch —')
  const w = demoWindow()
  if (!w.closesAt) {
    console.log('  MISSING  DEMO_CLOSES_AT is not set — the demo never closes by itself')
    failures++
  } else if (w.closed) {
    console.log(`  CLOSED   since ${w.closesAt.toISOString()} — every route answers /closed or 410`)
  } else {
    const hours = Math.round((w.msRemaining ?? 0) / 3600_000)
    console.log(`  OPEN     until ${w.closesAt.toISOString()} (about ${hours} hours left)`)
  }

  console.log('\n— Counter store —')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.log('  MISSING  no Supabase service-role credentials in .env.local')
    process.exit(1)
  }
  const db = createClient(url, key, { auth: { persistSession: false } })

  // A plain select, not a head+count: PostgREST answers a head request over a
  // missing table without an error, which would report a fence that is not there.
  const { error: tableError } = await db.from('usage_counters').select('key').limit(1)
  // A round trip through the real function, then undone — the table existing
  // without the function still leaves the caps inert, and that is the failure
  // this script exists to catch.
  const { error: fnError } = await db.rpc('bump_usage', { k: 'demo:check', n: 0 })

  if (tableError || fnError) {
    failures++
    console.log(`  MISSING  ${(tableError ?? fnError)?.message}`)
    console.log('\n  SPEND IS UNCAPPED until this is applied. Paste this into the')
    console.log('  Supabase SQL editor (Dashboard → SQL → New query):\n')
    const sql = await readFile(path.join(process.cwd(), 'supabase', 'demo-mode.sql'), 'utf8')
    console.log(
      sql
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n')
    )
  } else {
    console.log('  ok       usage_counters + bump_usage() are live')
  }

  console.log('\n— Budgets and spend —')
  const { data: rows } = await db.from('usage_counters').select('key, used, updated_at')
  const at = (k: string) => Number((rows ?? []).find((r) => r.key === k)?.used ?? 0)

  const ai = at(USAGE.aiUsd)
  console.log(`  Claude       ${money(ai)} of $${b.aiUsd.toFixed(2)}`)
  console.log(`  Voice        ${at(USAGE.speechChars)} of ${b.speechChars} characters`)
  console.log(`  Guests       ${at(USAGE.guests)} of ${b.guests} records`)
  console.log(`  Per visitor  ${b.callsPerUser} paid calls each`)

  const busiest = (rows ?? [])
    .filter((r) => String(r.key).startsWith(`${USAGE.perUserCalls}:`))
    .sort((a, b2) => Number(b2.used) - Number(a.used))
    .slice(0, 3)
  for (const r of busiest) {
    const id = String(r.key).slice(perUserKey('').length)
    console.log(`               ${id.slice(0, 8)}… used ${r.used}`)
  }

  console.log(failures === 0 ? '\nDEMO FENCE: READY\n' : `\nDEMO FENCE: ${failures} problem(s)\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main()
