import { createBrowserClient } from '@supabase/ssr'

/** Browser client — anon key only. RLS is the backstop for everything it touches. */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
