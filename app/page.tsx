import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Front door. Signed out → sign in. Signed in with no one to care for →
 * onboarding. Otherwise straight to the story.
 */
export default async function Home() {
  const db = await supabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect('/signin')

  const { count } = await db
    .from('memberships')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  if (!count) redirect('/onboarding')
  redirect('/timeline')
}
