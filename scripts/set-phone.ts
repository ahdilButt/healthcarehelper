import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

/**
 * Put a mobile number on a sign-in, so reminders have somewhere to go.
 *
 * The frozen schema keeps no phone column, and the app has no settings screen
 * for one yet, so the number lives on the Supabase auth user where the
 * notification path already looks for it (lib/notify/recipients.ts).
 *
 *   npm run set-phone -- amira@example.com +447700900412
 */
async function main() {
  const [email, phone] = process.argv.slice(2)
  if (!email || !phone) {
    console.error('Usage: npm run set-phone -- <email> <+44…>')
    process.exit(1)
  }
  if (!/^\+\d{8,15}$/.test(phone)) {
    console.error('The number must be E.164, e.g. +447700900412')
    process.exit(1)
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  )

  const { data, error } = await db.auth.admin.listUsers({ perPage: 200 })
  if (error) throw new Error(error.message)

  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (!user) throw new Error(`No sign-in for ${email}. Run npm run magic-link first.`)

  // user_metadata rather than the auth phone field: setting the latter starts
  // Supabase's own phone-verification flow, which is not what this is for.
  const { error: updateError } = await db.auth.admin.updateUserById(user.id, {
    user_metadata: { ...(user.user_metadata ?? {}), phone },
  })
  if (updateError) throw new Error(updateError.message)

  console.log(`${email} -> ${phone}`)
  console.log(
    process.env.SMS_DRY_RUN === 'false'
      ? 'SMS_DRY_RUN is off — the next tick will send a real text.'
      : 'SMS_DRY_RUN is on — the next tick will log instead of sending.'
  )
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
