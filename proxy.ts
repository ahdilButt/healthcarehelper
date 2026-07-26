import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { demoWindow } from '@/lib/demo/window'

/** The one path that still answers after closing time. */
const CLOSED_PATH = '/closed'

/**
 * Next 16 renamed `middleware` to `proxy` (runtime is always nodejs).
 * It does two things: shut the demo down when its time is up, and refresh the
 * Supabase session cookie so Server Components never see a stale token.
 *
 * It deliberately does NOT gate routes by membership: /c/[token] is the single
 * public path and guards its own token server-side, and every API route runs
 * its own membership check (API-CONTRACTS non-negotiable #1).
 *
 * The kill switch lives here because this is the one place every request
 * passes through — a page, an API route, a capsule link a clinician was given
 * yesterday. When the demo closes, all of it closes at once.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (demoWindow().closed && pathname !== CLOSED_PATH) {
    // Machines get the envelope every other route answers with; people get the
    // page. Neither gets a session refreshed — there is nothing left to use it
    // on until someone moves DEMO_CLOSES_AT.
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: { code: 'expired', message: 'This demo has closed.' } },
        { status: 410, headers: { 'cache-control': 'no-store' } }
      )
    }
    return NextResponse.rewrite(new URL(CLOSED_PATH, request.url))
  }

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
