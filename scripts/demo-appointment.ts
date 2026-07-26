import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { londonInstant } from '../lib/routines/time'

/**
 * Put the eye screening back in the near future.
 *
 * DATASET-BIBLE §7 dates it 14 July 2026, which was upcoming when the dataset
 * was written and is in the past by the time anyone demos it. Today's brief
 * only looks a week ahead, so the diary line reads "no appointments" and the
 * one beat that proves appointments exist never fires.
 *
 * Re-runnable: run it again if the demo slips a day.
 *
 *   npm run demo:appt          # two days from now
 *   npm run demo:appt -- 0     # today, to show the "today" wording
 */
const TITLE_MATCH = 'eye screening'
const DEFAULT_DAYS = 2
const AT = '10:20'

async function main() {
  const days = Number(process.argv[2] ?? DEFAULT_DAYS)
  if (!Number.isFinite(days) || days < 0 || days > 6) {
    console.error('Days must be 0-6 — the brief only looks a week ahead.')
    process.exit(1)
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  )

  const when = new Date(Date.now() + days * 86400000)
  const date = when.toISOString().slice(0, 10)
  const startsAt = londonInstant(date, AT).toISOString()

  const { data: appts } = await db
    .from('appointments')
    .select('id, person_id, title, starts_at')
    .ilike('title', `%${TITLE_MATCH}%`)

  if (!appts?.length) {
    console.error(`No appointment matching "${TITLE_MATCH}".`)
    process.exit(1)
  }

  for (const a of appts) {
    const { error } = await db
      .from('appointments')
      .update({ starts_at: startsAt, confirmed_at: new Date().toISOString() })
      .eq('id', a.id)
    console.log(`  ${a.title} -> ${date} ${AT}${error ? ` (ERR ${error.message})` : ''}`)
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
