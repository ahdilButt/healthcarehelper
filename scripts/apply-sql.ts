import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Client } from 'pg'

/**
 * `npm run db:apply` — the schema, applied by machine.
 *
 * Everything else in this repo talks to Supabase through PostgREST, which
 * cannot create a table. So the schema has always been a copy-paste into the
 * dashboard, and "did anyone actually paste it?" has been a real source of
 * confusion — a missing table looks exactly like a feature that was never
 * built. A direct Postgres connection removes the step entirely.
 *
 * Each file goes to the server as ONE statement string, so Postgres runs it in
 * a single implicit transaction: it either all lands or none of it does. There
 * is no half-applied schema to unpick, and no fragile client-side splitting on
 * semicolons (which would cut every `$$ … $$` function body in half).
 */

const DEFAULT_FILES = ['schema.sql', 'demo-mode.sql']

/** Postgres says "this already exists" in several dialects of the same idea. */
const ALREADY = new Set([
  '42P07', // duplicate_table
  '42710', // duplicate_object (type, policy, …)
  '42P06', // duplicate_schema
  '42723', // duplicate_function
])

async function main() {
  const url = process.env.SUPABASE_DB_URL
  if (!url) {
    console.error(`
SUPABASE_DB_URL is not set.

Supabase dashboard → Connect (top bar) → Session pooler → copy the URI, and
put it in .env.local as SUPABASE_DB_URL. It contains the database password,
so it belongs there and nowhere else.

  SUPABASE_DB_URL=postgresql://postgres.abcd…:PASSWORD@aws-0-eu-west-2.pooler.supabase.com:5432/postgres

Use the SESSION pooler (port 5432), not the transaction one (6543) — the
transaction pooler cannot run the statements in this schema.
`)
    process.exit(1)
  }

  const wanted = process.argv.slice(2).filter((a) => a.endsWith('.sql'))
  const files = wanted.length ? wanted.map((f) => path.basename(f)) : DEFAULT_FILES

  // Supabase terminates plaintext connections; its certificate chain is not in
  // Node's trust store, hence the relaxed check on an already-encrypted link.
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await client.connect()
  console.log(`connected to ${new URL(url).host}\n`)

  let failures = 0
  for (const file of files) {
    const sql = await readFile(path.join(process.cwd(), 'supabase', file), 'utf8')
    try {
      await client.query(sql)
      console.log(`  applied  ${file}`)
    } catch (e) {
      const err = e as { code?: string; message?: string }
      if (err.code && ALREADY.has(err.code)) {
        // Nothing changed — the whole file rolled back, which is the right
        // outcome for a re-run of a file that has no IF NOT EXISTS in it.
        console.log(`  already  ${file} (${err.message})`)
      } else {
        failures++
        console.error(`  FAILED   ${file}: ${err.message}`)
      }
    }
  }

  await client.end()
  console.log(failures === 0 ? '\nSCHEMA: APPLIED\n' : `\nSCHEMA: ${failures} file(s) failed\n`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('FAILED:', e instanceof Error ? e.message : e)
  process.exit(1)
})
