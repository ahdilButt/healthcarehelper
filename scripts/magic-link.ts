import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
import { createClient } from '@supabase/supabase-js'

/**
 * Mint a sign-in link without an email inbox.
 *
 *   npm run magic-link                                   # local, default owner
 *   npm run magic-link -- dad@example.com                # local, another person
 *   npm run magic-link -- amira@example.com --prod       # against production
 *   npm run magic-link -- amira@example.com https://…    # against anything
 *
 * This exists because Supabase's built-in mailer rate-limits magic links to a
 * handful an hour, and testing means signing in and out far more often than
 * that. generateLink goes through the admin API, so it neither sends an email
 * nor counts against that limit — you can mint as many as you like.
 *
 * Never exposed as a route: it uses the service-role key and would be an
 * unauthenticated way into anybody's record.
 */
const PROD = 'https://healthcarehelper-pi.vercel.app'

async function main() {
  const args = process.argv.slice(2)
  const given = args.find((a) => a.includes('@'))
  const target = args.find((a) => a.startsWith('http'))
  const wantsProd = args.includes('--prod')

  // Falling back to the default owner while pointed at a real deployment is
  // how you hand somebody a link that signs them in AS YOU. Away from
  // localhost, the address has to be said out loud.
  if (!given && (wantsProd || target)) {
    console.error('Name the address explicitly when targeting a deployment:')
    console.error('  npm run magic-link -- someone@example.com --prod')
    process.exit(1)
  }

  const email = given ?? process.env.SEED_OWNER_EMAIL ?? 'amira@example.com'
  const appUrl = (target ?? (wantsProd ? PROD : process.env.APP_URL) ?? 'http://localhost:3000').replace(/\/$/, '')

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  )

  const redirectTo = `${appUrl}/auth/callback?next=/timeline`
  let { data, error } = await db.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo },
  })

  // magiclink only works for someone who already exists; a fresh address needs
  // a signup link instead. Testing should not require knowing which.
  if (error && /not found|does not exist/i.test(error.message)) {
    ;({ data, error } = await db.auth.admin.generateLink({
      type: 'signup',
      email,
      password: crypto.randomUUID(),
      options: { redirectTo },
    }))
  }

  if (error || !data?.properties) {
    console.error(error?.message ?? 'Could not mint a link.')
    process.exit(1)
  }

  console.log(`\nThis link signs the holder in AS ${email}`)
  console.log(`on ${appUrl}\n`)
  console.log(data.properties.action_link)
  console.log(
    `\nOne use, then spent. Anyone who opens it becomes that account — send it only to whoever owns the address.\n`
  )
}

main()
