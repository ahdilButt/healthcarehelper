import type { SupabaseClient } from '@supabase/supabase-js'
import type { CapsuleKind } from '@/lib/types'

/**
 * The one unauthenticated door in the app (SPEC-FINAL §7).
 *
 * Everything here runs server-side with the service-role key, and only ever
 * AFTER the token has been checked — the anon key can read nothing, so a
 * guessed URL gets a 410 page rather than a record.
 */

export interface CapsuleRow {
  id: string
  person_id: string
  kind: CapsuleKind
  token: string
  expires_at: string | null
  revoked_at: string | null
}

export type CapsuleAccess =
  | { ok: true; capsule: CapsuleRow }
  | { ok: false; reason: 'not_found' | 'expired' | 'revoked' }

export async function openCapsule(
  service: SupabaseClient,
  token: string,
  now = new Date()
): Promise<CapsuleAccess> {
  if (!token || token.length < 20) return { ok: false, reason: 'not_found' }

  const { data } = await service
    .from('capsules')
    .select('id, person_id, kind, token, expires_at, revoked_at')
    .eq('token', token)
    .maybeSingle()

  if (!data) return { ok: false, reason: 'not_found' }
  const capsule = data as CapsuleRow

  // Revocation is checked before expiry: someone who revoked a link wants to
  // hear that it is revoked, not that it timed out on its own.
  if (capsule.revoked_at) return { ok: false, reason: 'revoked' }
  if (capsule.expires_at && new Date(capsule.expires_at) <= now) {
    return { ok: false, reason: 'expired' }
  }
  return { ok: true, capsule }
}

/** Every open is logged — the manage card says "Opened Tue 14:02". */
export async function logView(service: SupabaseClient, capsuleId: string, userAgent: string | null) {
  await service.from('capsule_views').insert({
    capsule_id: capsuleId,
    user_agent: userAgent?.slice(0, 300) ?? null,
  })
}

/**
 * A deliberately small per-IP limit on the public route.
 *
 * In-memory, so it resets when the instance does and does not span instances.
 * That is honest for what it is: a brake on someone walking the token space
 * from one machine, not a distributed rate limiter. The 192-bit token is what
 * actually makes guessing hopeless.
 */
const HITS = new Map<string, { count: number; until: number }>()
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 30

export function rateLimited(ip: string, now = Date.now()): boolean {
  const seen = HITS.get(ip)
  if (!seen || seen.until <= now) {
    HITS.set(ip, { count: 1, until: now + WINDOW_MS })
    if (HITS.size > 5000) for (const [k, v] of HITS) if (v.until <= now) HITS.delete(k)
    return false
  }
  seen.count++
  return seen.count > MAX_PER_WINDOW
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  )
}
