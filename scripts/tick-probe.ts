import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { runTick } from '../lib/notify/tick'
import { londonDate, londonInstant } from '../lib/routines/time'

/**
 * Run one minute of the cron by hand, optionally pretending it is a different
 * time of day.
 *
 * The reminder path only does anything in the few minutes after a dose is due,
 * so this is how you rehearse "a text lands on Dad's lock screen" at four in
 * the afternoon without waiting until eight. The HTTP route takes no time
 * override on purpose — a SYSTEM endpoint that can be told what time it is is
 * an endpoint that can be told to replay yesterday.
 *
 *   npm run tick            # now
 *   npm run tick -- 08:00   # as if it were this morning's round
 */
async function main() {
  const at = process.argv[2]
  if (at && !/^([01]\d|2[0-3]):[0-5]\d$/.test(at)) {
    console.error('Usage: npm run tick -- [HH:MM]')
    process.exit(1)
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  )

  const now = at ? londonInstant(londonDate(), at) : new Date()
  console.log(`tick at ${now.toISOString()} (SMS_DRY_RUN=${process.env.SMS_DRY_RUN ?? 'true'})\n`)

  const result = await runTick(db, now)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
