import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { DOCUMENTS_BUCKET } from '../lib/constants'

/**
 * Empty the record, for the M3 unplug (BUILD-GUIDE §3).
 *
 * Deletes every person and everything that hangs off one, plus the stored
 * originals. Sign-ins survive, because the point of M3 is to prove the record
 * assembles itself from the letters — not to make you re-verify an email.
 *
 * Deliberately awkward to run:
 *   npm run wipe -- --yes-really
 */
async function main() {
  if (!process.argv.includes('--yes-really')) {
    console.error('This deletes every record in the database.')
    console.error('Run: npm run wipe -- --yes-really')
    process.exit(1)
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  )

  const { data: persons } = await db.from('persons').select('id, display_name')
  console.log(`persons: ${(persons ?? []).map((p) => p.display_name).join(', ') || '(none)'}`)

  // Storage first: once the rows are gone their paths are unknowable.
  for (const person of persons ?? []) {
    const { data: files } = await db.storage.from(DOCUMENTS_BUCKET).list(person.id, { limit: 1000 })
    for (const folder of files ?? []) {
      const { data: inner } = await db.storage
        .from(DOCUMENTS_BUCKET)
        .list(`${person.id}/${folder.name}`, { limit: 100 })
      const paths = (inner ?? []).map((f) => `${person.id}/${folder.name}/${f.name}`)
      if (paths.length) await db.storage.from(DOCUMENTS_BUCKET).remove(paths)
    }
  }

  // Everything else cascades from persons, except the two tables keyed
  // elsewhere — messages hang off conversations, capsule_views off capsules.
  const { error } = await db.from('persons').delete().not('id', 'is', null)
  if (error) throw new Error(error.message)

  for (const table of ['notifications', 'conversations', 'capsules']) {
    await db.from(table).delete().not('id', 'is', null)
  }

  const counts: string[] = []
  for (const table of ['persons', 'documents', 'medications', 'results', 'open_loops', 'routines', 'capsules', 'conversations', 'notifications']) {
    const { count } = await db.from(table).select('*', { count: 'exact', head: true })
    counts.push(`${table}=${count ?? 0}`)
  }
  console.log(counts.join(' '))
  console.log('\nWiped. Sign-ins are untouched — open the app and it will ask who you care for.')
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
