import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase/server'

/** Magic-link landing. Exchanges the code for a session, then goes where asked. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/timeline'

  if (code) {
    const db = await supabaseServer()
    const { error } = await db.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  return NextResponse.redirect(new URL('/signin?error=link', url.origin))
}
