import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import type { PersonSummary } from '@/lib/types'
import { PERSON_COOKIE } from '@/lib/constants'

/**
 * Who the app is currently showing. The switcher writes a cookie; we always
 * validate it against the caller's memberships so a stale or tampered cookie
 * can never widen access.
 */
export async function currentPerson(): Promise<{
  person: PersonSummary | null
  people: PersonSummary[]
  userId: string | null
  email: string | null
}> {
  const db = await supabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return { person: null, people: [], userId: null, email: null }

  const { data } = await db
    .from('memberships')
    .select('role, persons!inner(id, display_name)')
    .eq('user_id', user.id)

  const people: PersonSummary[] = (data ?? []).map((row) => {
    const p = row.persons as unknown as { id: string; display_name: string }
    return { id: p.id, displayName: p.display_name, role: row.role }
  })
  // "Dad" before "Amira": the record being cared for is the point of the app.
  people.sort((a, b) => (a.role === 'owner' && b.role === 'owner' ? 0 : 0) || a.displayName.localeCompare(b.displayName))

  const wanted = (await cookies()).get(PERSON_COOKIE)?.value
  const person = people.find((p) => p.id === wanted) ?? people[0] ?? null
  return { person, people, userId: user.id, email: user.email ?? null }
}
