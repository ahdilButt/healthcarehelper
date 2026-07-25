import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * Service-role client — bypasses RLS.
 *
 * SECURITY (BUILD-GUIDE §4): only ever used on code paths marked SYSTEM or
 * PUBLIC in API-CONTRACTS.md, and only AFTER the path has validated its own
 * credential (capsule token, invite token, x-cron-secret). The `server-only`
 * import makes it a build error to pull this into a client bundle.
 */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
