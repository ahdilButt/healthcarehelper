import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Onboarding sits outside the (tabs) group, so it never inherited that
 * layout's session check — you could reach the "what do you call them" form
 * signed out, fill it in, and only find out when POST /api/persons answered
 * "Please sign in." The work was lost and the message appeared on a screen
 * that had never mentioned signing in.
 *
 * Now the check happens before the form is ever drawn, and `next` brings them
 * straight back here once they are in.
 */
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const db = await supabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()

  if (!user) redirect('/signin?next=%2Fonboarding')

  return children
}
