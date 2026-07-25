import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Request-scoped Supabase client carrying the caller's session.
 * RLS applies — this client can only ever see rows the signed-in user may see.
 * Next 16: cookies() is async.
 */
export async function supabaseServer() {
  const store = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) store.set(name, value, options)
          } catch {
            // Called from a Server Component render — refresh happens in the
            // route handler / proxy instead. Safe to ignore.
          }
        },
      },
    }
  )
}
