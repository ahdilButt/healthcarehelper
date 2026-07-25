import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Who a reminder goes to. "Reminders go to Dad's phone AND Amira's"
 * (SPEC-FINAL §6) — the whole point of the product is that one person can hold
 * another person's care without living with them.
 *
 * The frozen schema keeps no phone column, so the number lives where Supabase
 * already keeps it: on the auth user. Reading it needs the admin API, which is
 * why this file is SYSTEM-only and imports `server-only`.
 */

export interface Recipient {
  userId: string
  phone: string | null
  email: string | null
}

export async function recipientsFor(
  service: SupabaseClient,
  personId: string
): Promise<Recipient[]> {
  const { data: members } = await service
    .from('memberships')
    .select('user_id')
    .eq('person_id', personId)

  const out: Recipient[] = []
  for (const m of members ?? []) {
    const userId = m.user_id as string
    const { data } = await service.auth.admin.getUserById(userId)
    const user = data?.user
    if (!user) continue
    const metadata = (user.user_metadata ?? {}) as { phone?: string }
    out.push({
      userId,
      phone: user.phone || metadata.phone || null,
      email: user.email ?? null,
    })
  }
  return out
}
