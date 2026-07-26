import { NextResponse } from 'next/server'
import { ApiError, route } from '@/lib/api/errors'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { cloneRecord, templatePersonId } from '@/lib/demo/clone'
import { USAGE, budgets, refund, reserve } from '@/lib/usage/meter'
import { PERSON_COOKIE } from '@/lib/constants'

/**
 * POST /api/demo/guest — "have a look around", without an account.
 *
 * Not in the frozen contract: an addition, no existing signature moves.
 *
 * An anonymous Supabase session rather than one shared login, because a shared
 * login is not a demo of this product — it is a demo of a filing cabinet with
 * the door off. Everyone would write into the same record, the third visitor
 * would find the second visitor's corrections on their father's medicines, and
 * "private by default" on the welcome screen would be a lie. An anonymous user
 * is a real account with a real id, so every membership check, every RLS
 * policy and every capsule token behaves exactly as it does for a signed-in
 * family — there is no guest branch anywhere else in the app, which is the
 * point.
 *
 * Requires "Anonymous sign-ins" to be enabled in the Supabase dashboard
 * (Authentication → Sign In / Providers). If it is off this route says so
 * rather than failing obscurely.
 */
export const POST = route(async () => {
  const db = await supabaseServer()

  // Someone who already has a session should not collect accounts by tapping
  // twice. If they already have a record, this is a no-op that hands it back.
  const {
    data: { user: existing },
  } = await db.auth.getUser()

  if (existing) {
    const { data: mine } = await db
      .from('memberships')
      .select('person_id')
      .eq('user_id', existing.id)
      .limit(1)
    const already = mine?.[0]?.person_id as string | undefined
    if (already) return handoff(already)
  }

  let userId = existing?.id ?? null
  if (!userId) {
    const { data, error } = await db.auth.signInAnonymously()
    if (error || !data.user) {
      console.error('[guest] anonymous sign-in failed:', error?.message)
      throw new ApiError(
        'forbidden',
        'Guest access is not switched on for this demo. Sign in with an email instead.'
      )
    }
    userId = data.user.id
  }

  const service = supabaseService()
  const template = await templatePersonId(service)
  if (!template) {
    throw new ApiError('not_found', 'There is no demo record to show you yet.')
  }

  // Counted and capped: every guest is a copy of twenty documents, and the
  // record they get is one an AI can be asked about — both cost something.
  if (!(await reserve(USAGE.guests, 1, budgets().guests))) {
    throw new ApiError(
      'rate_limited',
      'This demo has had all the visitors it can hold. Try again another time.'
    )
  }

  try {
    const result = await cloneRecord(service, { templatePersonId: template, userId })
    console.log(`[guest] provisioned ${result.documents} documents, ${result.facts} facts`)
    return handoff(result.personId)
  } catch (e) {
    // Give the slot back — nobody got a record out of this.
    await refund(USAGE.guests, 1)
    console.error('[guest] provisioning failed:', e instanceof Error ? e.message : e)
    throw new ApiError('processing_failed', 'We could not set up a record for you just now.')
  }
})

/** Hand back the record and point the switcher at it. */
function handoff(personId: string) {
  const res = NextResponse.json({ personId })
  // Same shape the switcher writes (app/actions.ts) — httpOnly, because the
  // browser never needs to read it and currentPerson() re-validates it against
  // memberships anyway.
  res.cookies.set(PERSON_COOKIE, personId, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    httpOnly: true,
  })
  return res
}
