import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const TABLES = ['persons','memberships','invites','documents','conditions','medications','med_change_events','allergies','results','appointments','open_loops','corrections','routines','taken_events','capsules','capsule_views','conversations','messages','notifications']

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  let missing = 0
  for (const t of TABLES) {
    // A plain select, NOT head+count: PostgREST answers a head request over a
    // missing table without an error, so the count form reported a fully
    // applied schema against an empty project.
    const { error } = await db.from(t).select('*').limit(1)
    if (error) { console.log(`  MISSING ${t.padEnd(20)} ${error.message}`); missing++ }
    else console.log(`  ok      ${t}`)
  }
  const { data: buckets, error: be } = await db.storage.listBuckets()
  console.log('storage buckets:', be ? be.message : ((buckets ?? []).map(b => `${b.name}(public=${b.public})`).join(', ') || '(none)'))
  console.log(missing === 0 ? '\nSCHEMA: APPLIED' : `\nSCHEMA: ${missing}/${TABLES.length} tables missing`)
}
main()
