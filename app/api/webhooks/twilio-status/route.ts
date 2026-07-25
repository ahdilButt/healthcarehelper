import { createHmac, timingSafeEqual } from 'node:crypto'
import { ApiError, route } from '@/lib/api/errors'
import { supabaseService } from '@/lib/supabase/service'

/**
 * POST /api/webhooks/twilio-status — SYSTEM. Twilio tells us whether the text
 * actually landed, which is the only way "a real SMS arrives on Dad's lock
 * screen" is a claim we can check rather than hope.
 *
 * The signature is validated before anything is read as truth: this endpoint
 * is public by necessity, and an unvalidated one is a stranger writing to the
 * delivery log.
 */

const DELIVERED = new Set(['delivered', 'sent'])
const FAILED = new Set(['failed', 'undelivered'])

export const POST = route(async (req: Request) => {
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!token) throw new ApiError('unauthorized', 'Not configured.')

  const form = await req.formData().catch(() => null)
  if (!form) throw new ApiError('invalid_input', 'Expected a form post.')

  const params: Record<string, string> = {}
  for (const [k, v] of form.entries()) params[k] = String(v)

  if (!validSignature(req, params, token)) {
    throw new ApiError('unauthorized', 'Bad signature.')
  }

  const status = (params.MessageStatus ?? '').toLowerCase()
  const sid = params.MessageSid
  if (!sid || (!DELIVERED.has(status) && !FAILED.has(status))) {
    return new Response(null, { status: 204 })
  }

  await supabaseService()
    .from('notifications')
    .update({ status: DELIVERED.has(status) ? 'sent' : 'failed' })
    .eq('payload->>message_sid', sid)

  return new Response(null, { status: 204 })
})

/**
 * Twilio signs the full URL with every POST parameter appended in key order.
 * APP_URL is preferred over the request's own host header, which a proxy — or
 * an attacker — can set.
 */
function validSignature(req: Request, params: Record<string, string>, token: string): boolean {
  const given = req.headers.get('x-twilio-signature')
  if (!given) return false

  const path = new URL(req.url).pathname
  const base = (process.env.APP_URL ?? new URL(req.url).origin).replace(/\/$/, '')
  let payload = `${base}${path}`
  for (const key of Object.keys(params).sort()) payload += key + params[key]

  const expected = createHmac('sha1', token).update(Buffer.from(payload, 'utf-8')).digest('base64')
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}
