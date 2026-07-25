import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
import { createClient } from '@supabase/supabase-js'

/**
 * Dev convenience: mint a sign-in link without an email inbox.
 *   npx tsx scripts/magic-link.ts amira@example.com
 * Never exposed as a route — this is a local script using the service-role key.
 */
async function main() {
  const email = process.argv[2] ?? process.env.SEED_OWNER_EMAIL ?? 'amira@example.com'
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const { data, error } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${appUrl}/auth/callback?next=/timeline` },
  })
  if (error) { console.error(error.message); process.exit(1) }
  console.log(`\nSign-in link for ${email}:\n\n${data.properties.action_link}\n`)
}
main()
