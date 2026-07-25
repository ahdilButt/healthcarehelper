'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { PERSON_COOKIE } from '@/lib/constants'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Switch which person the app is showing.
 *
 * Done as a Server Action rather than a client-side cookie write so membership
 * is checked before the cookie is set — a caller can't point the shell at a
 * record they aren't a member of. (currentPerson() re-validates anyway; this
 * just refuses the switch outright rather than silently ignoring it.)
 */
export async function setCurrentPerson(personId: string) {
  const db = await supabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return

  const { data } = await db
    .from('memberships')
    .select('person_id')
    .eq('user_id', user.id)
    .eq('person_id', personId)
    .maybeSingle()
  if (!data) return

  ;(await cookies()).set(PERSON_COOKIE, personId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
  })
  revalidatePath('/', 'layout')
}

/**
 * Sign out.
 *
 * A magic-link session persists and refreshes itself, so without this a device
 * stays signed in indefinitely — which is right for Dad's phone on the kitchen
 * table, and wrong for testing, for a shared laptop, and for a demo where the
 * second phone has to arrive as a stranger.
 *
 * The person cookie goes too: it is the last trace of whose record was open.
 */
export async function signOut() {
  const db = await supabaseServer()
  await db.auth.signOut()
  ;(await cookies()).delete(PERSON_COOKIE)
  revalidatePath('/', 'layout')
  redirect('/signin')
}
