/**
 * Reminders leave the app (SPEC-FINAL §6, decision R6): SMS first via Twilio,
 * email as the fallback. No web push.
 *
 * Server-side only, but deliberately without the `server-only` marker: the
 * demo runbook drives this same code from a script (npm run tick), and that
 * marker makes any plain Node import a hard error. The keys it reads are
 * non-public env vars, so they are undefined rather than leaked in any bundle,
 * and the service-role client — the thing actually worth protecting — keeps
 * its own `server-only` in lib/supabase/service.ts.
 *
 * SMS_DRY_RUN is not a test seam — it is the safety catch. Real texts go to
 * real phones, and a loop bug in a cron that runs every minute is a phone that
 * buzzes every minute. It stays on until someone deliberately turns it off.
 */

export type Channel = 'sms' | 'email'

export interface SendResult {
  ok: boolean
  channel: Channel
  detail: string
  /** Twilio's message id, so the delivery webhook can find this row again. */
  sid?: string
}

const dryRun = () => process.env.SMS_DRY_RUN !== 'false'

const usable = (v: string | undefined): v is string =>
  Boolean(v && v.trim() && !v.startsWith('re_PAS') && !v.includes('your-'))

export function smsConfigured(): boolean {
  return (
    usable(process.env.TWILIO_ACCOUNT_SID) &&
    usable(process.env.TWILIO_AUTH_TOKEN) &&
    usable(process.env.TWILIO_FROM_NUMBER)
  )
}

export function emailConfigured(): boolean {
  return usable(process.env.EMAIL_API_KEY)
}

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (dryRun() || !smsConfigured()) {
    // Never the message body: an SMS body is somebody's medication round.
    console.log(`[sms] dry run -> ${mask(to)} (${body.length} chars)`)
    return { ok: true, channel: 'sms', detail: 'dry_run' }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID as string
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${auth}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      To: to,
      From: process.env.TWILIO_FROM_NUMBER as string,
      Body: body,
      ...(process.env.APP_URL ? { StatusCallback: `${process.env.APP_URL}/api/webhooks/twilio-status` } : {}),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`[sms] twilio ${res.status}: ${detail.slice(0, 200)}`)
    return { ok: false, channel: 'sms', detail: `twilio_${res.status}` }
  }

  const sent = (await res.json().catch(() => null)) as { sid?: string } | null
  return { ok: true, channel: 'sms', detail: 'sent', ...(sent?.sid ? { sid: sent.sid } : {}) }
}

export async function sendEmail(to: string, subject: string, body: string): Promise<SendResult> {
  if (dryRun() || !emailConfigured()) {
    console.log(`[email] dry run -> ${mask(to)} (${subject})`)
    return { ok: true, channel: 'email', detail: 'dry_run' }
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.EMAIL_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: 'HealthcareHelper <onboarding@resend.dev>',
      to: [to],
      subject,
      text: body,
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error(`[email] resend ${res.status}: ${detail.slice(0, 200)}`)
    return { ok: false, channel: 'email', detail: `resend_${res.status}` }
  }
  return { ok: true, channel: 'email', detail: 'sent' }
}

/** No PII in logs (BUILD-GUIDE §4) — enough to debug routing, not to identify. */
const mask = (v: string) => (v.length <= 4 ? '****' : `${v.slice(0, 2)}…${v.slice(-2)}`)
