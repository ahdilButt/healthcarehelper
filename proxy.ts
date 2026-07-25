import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Next 16 renamed `middleware` to `proxy` (runtime is always nodejs).
 * Its only job is refreshing the Supabase session cookie so Server Components
 * never see a stale token.
 *
 * It deliberately does NOT gate routes: /c/[token] is the single public path
 * and guards its own token server-side, and every API route runs its own
 * membership check (API-CONTRACTS non-negotiable #1).
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value)
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options)
        },
      },
    }
  )

  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: [
    // Everything except static assets and image files.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
