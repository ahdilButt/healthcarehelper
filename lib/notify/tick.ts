import type { SupabaseClient } from '@supabase/supabase-js'
import { CONFIRMED_THRESHOLD } from '@/lib/constants'
import { applyCorrections, correctionsForPerson, factKey } from '@/lib/facts/read'
import { humanDocName, shortDate } from '@/lib/timeline/build'
import { londonDate, londonInstant, humanTime } from '@/lib/routines/time'
import { recipientsFor, type Recipient } from './recipients'
import { sendEmail, sendSms, type SendResult } from './send'
import { demoWindow } from '@/lib/demo/window'
import { reserve, used } from '@/lib/usage/meter'

/**
 * One minute of work (API-CONTRACTS.md /api/cron/tick).
 *
 * Everything that leaves the app leaves from here, on the SYSTEM path, with
 * the service-role key — because notifications have no insert policy and
 * nothing else should be able to make this app send a text.
 *
 * Two rules are absolute. Nothing unconfirmed is ever sent (SPEC-FINAL §3): a
 * dose read off a blurred box must not buzz two phones at eight in the morning.
 * And every what-changed message names the letter it came from, because a text
 * saying a dose moved, with no source, is exactly the kind of message that
 * makes a family stop trusting the app.
 */

export interface TickResult {
  remindersSent: number
  loopsFlippedOverdue: number
  whatChangedSent: number
}

/** The tick runs every minute; this window forgives a late or skipped run. */
const WINDOW_MS = 5 * 60 * 1000
const DRAIN_LIMIT = 50
const LOOKBACK_HOURS = 48

export async function runTick(service: SupabaseClient, now = new Date()): Promise<TickResult> {
  await warnDemoClosing(now)
  const loopsFlippedOverdue = await flipOverdueLoops(service)

  const { data: persons } = await service.from('persons').select('id, display_name')

  for (const person of persons ?? []) {
    const to = await recipientsFor(service, person.id)
    if (!to.length) continue
    await queueReminders(service, person.id, person.display_name, to, now)
    await queueWhatChanged(service, person.id, person.display_name, to, now)
  }

  const drained = await drain(service, now)
  return { ...drained, loopsFlippedOverdue }
}

/**
 * Belt and braces on the kill switch: a heads-up the day before it fires.
 *
 * The switch itself is an environment variable nobody will be looking at, and
 * the failure it protects against — a demo closing mid-conversation with real
 * people in it — is easier to prevent than to explain. This tick already runs
 * every minute, so it is the cheapest place to notice.
 *
 * Sent exactly once: the counter table is the memory (a serverless function
 * has none), and if it cannot be read the mail is skipped rather than sent
 * every sixty seconds.
 */
const WARN_KEY = 'demo:closing_warned'
const DAY_MS = 24 * 3600 * 1000

async function warnDemoClosing(now: Date) {
  const to = process.env.DEMO_OWNER_EMAIL?.trim()
  const { closesAt, closed, msRemaining } = demoWindow(now)
  if (!to || !closesAt || closed || (msRemaining ?? 0) > DAY_MS) return

  if ((await used(WARN_KEY)) === null) return
  if (!(await reserve(WARN_KEY, 1, 1))) return

  const hours = Math.max(1, Math.round((msRemaining ?? 0) / 3600_000))
  await sendEmail(
    to,
    'Aftercare: the demo closes in about a day',
    `The public demo closes at ${closesAt.toISOString()} — about ${hours} hours from now.\n\n` +
      'After that every page answers the closed notice and every API route answers 410.\n' +
      'To move the date, edit DEMO_CLOSES_AT in Vercel; it takes effect on the next request.'
  )
}

/**
 * A referral nobody chased is the thing this product exists to catch, so the
 * flip is unconditional and dated in the family's day, not the server's.
 */
async function flipOverdueLoops(service: SupabaseClient): Promise<number> {
  const { data } = await service
    .from('open_loops')
    .update({ state: 'overdue' })
    .eq('state', 'waiting')
    .lt('expected_date', londonDate())
    .select('id')
  return data?.length ?? 0
}

interface RoutineRow {
  id: string
  medication_id: string
  times: string[]
  enabled: boolean
}

async function queueReminders(
  service: SupabaseClient,
  personId: string,
  personName: string,
  to: Recipient[],
  now: Date
) {
  const today = londonDate(now)
  const [{ data: routines }, { data: meds }, corrections] = await Promise.all([
    service.from('routines').select('id, medication_id, times, enabled').eq('person_id', personId),
    service
      .from('medications')
      .select('id, name, current_dose, is_active')
      .eq('person_id', personId),
    correctionsForPerson(service, personId),
  ])

  const byId = new Map(
    ((meds ?? []) as { id: string; name: string; current_dose: string; is_active: boolean }[]).map(
      (m) => [m.id, applyCorrections(m, corrections.get(factKey('medications', m.id)))]
    )
  )

  // One text per round, not one per pill: five separate buzzes at eight in the
  // morning is not a reminder, it is a reason to turn reminders off.
  const rounds = new Map<string, string[]>()
  for (const r of (routines ?? []) as RoutineRow[]) {
    if (!r.enabled) continue
    const med = byId.get(r.medication_id)
    if (!med?.is_active) continue
    for (const time of r.times ?? []) {
      const due = londonInstant(today, time)
      const age = now.getTime() - due.getTime()
      if (age < 0 || age > WINDOW_MS) continue
      const list = rounds.get(time) ?? []
      list.push(`${med.name} ${med.current_dose}`)
      rounds.set(time, list)
    }
  }
  if (!rounds.size) return

  for (const [time, items] of rounds) {
    const scheduledFor = londonInstant(today, time).toISOString()
    const body = `${personName}'s ${humanTime(time)} medicines: ${items.join(', ')}.`
    await queue(service, personId, to, {
      notifType: 'reminder',
      scheduledFor,
      key: `reminder:${time}`,
      subject: `${personName}'s medicines`,
      body,
    })
  }
}

interface ChangeRow {
  id: string
  medication_id: string
  old_dose: string | null
  new_dose: string
  changed_on: string | null
  source_document_id: string
  confidence: number
  confirmed_at: string | null
  created_at: string
}

async function queueWhatChanged(
  service: SupabaseClient,
  personId: string,
  personName: string,
  to: Recipient[],
  now: Date
) {
  const since = new Date(now.getTime() - LOOKBACK_HOURS * 3600 * 1000).toISOString()
  const { data: changes } = await service
    .from('med_change_events')
    .select('*')
    .eq('person_id', personId)
    .gte('created_at', since)

  const fresh = ((changes ?? []) as ChangeRow[]).filter(
    (c) => Number(c.confidence) >= CONFIRMED_THRESHOLD || c.confirmed_at
  )
  if (!fresh.length) return

  const [{ data: meds }, { data: docs }] = await Promise.all([
    service.from('medications').select('id, name').eq('person_id', personId),
    service.from('documents').select('id, doc_type, sender, doc_date').eq('person_id', personId),
  ])
  const medName = new Map(((meds ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name]))
  const byDoc = new Map(
    ((docs ?? []) as { id: string; doc_type: string | null; sender: string | null; doc_date: string | null }[]).map(
      (d) => [d.id, d]
    )
  )

  for (const c of fresh) {
    const name = medName.get(c.medication_id) ?? 'A medicine'
    const doc = byDoc.get(c.source_document_id)
    const from = doc
      ? ` — from the ${humanDocName(doc.doc_type, doc.sender)}${doc.doc_date ? ` of ${shortDate(doc.doc_date)}` : ''}`
      : ''
    const body = c.old_dose
      ? `${personName}: ${name} is now ${c.new_dose} (was ${c.old_dose})${from}.`
      : `${personName}: ${name} ${c.new_dose} has been started${from}.`

    await queue(service, personId, to, {
      notifType: 'what_changed',
      scheduledFor: c.created_at,
      key: `change:${c.id}`,
      subject: `${personName}: ${name} changed`,
      body,
      citesDocumentId: c.source_document_id,
    })
  }
}

interface QueueSpec {
  notifType: 'reminder' | 'what_changed'
  scheduledFor: string
  /** Stable per message, so a tick that runs twice does not send twice. */
  key: string
  subject: string
  body: string
  citesDocumentId?: string
}

async function queue(
  service: SupabaseClient,
  personId: string,
  to: Recipient[],
  spec: QueueSpec
) {
  const { data: already } = await service
    .from('notifications')
    .select('target_user')
    .eq('person_id', personId)
    .eq('notif_type', spec.notifType)
    .eq('payload->>key', spec.key)

  const sent = new Set((already ?? []).map((n) => n.target_user as string))

  const rows = to
    .filter((r) => !sent.has(r.userId) && (r.phone || r.email))
    .map((r) => ({
      person_id: personId,
      target_user: r.userId,
      notif_type: spec.notifType,
      channel: r.phone ? 'sms' : 'email',
      payload: {
        key: spec.key,
        body: spec.body,
        subject: spec.subject,
        to: r.phone ?? r.email,
        fallback: r.email,
        ...(spec.citesDocumentId ? { cites_document_id: spec.citesDocumentId } : {}),
      },
      scheduled_for: spec.scheduledFor,
      status: 'pending',
    }))

  if (rows.length) await service.from('notifications').insert(rows)
}

interface NotificationRow {
  id: string
  notif_type: 'reminder' | 'what_changed'
  channel: 'sms' | 'email'
  payload: { body: string; subject: string; to: string | null; fallback: string | null }
}

async function drain(service: SupabaseClient, now: Date) {
  const { data: pending } = await service
    .from('notifications')
    .select('id, notif_type, channel, payload')
    .eq('status', 'pending')
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(DRAIN_LIMIT)

  let remindersSent = 0
  let whatChangedSent = 0

  for (const n of (pending ?? []) as NotificationRow[]) {
    const { body, subject, to, fallback } = n.payload
    let result: SendResult = { ok: false, channel: n.channel, detail: 'no_address' }

    if (n.channel === 'sms' && to) result = await sendSms(to, body)
    else if (to) result = await sendEmail(to, subject, body)

    // Email is the fallback, so a phone that rejects the text still reaches
    // someone rather than silently dropping a medication reminder.
    if (!result.ok && fallback && fallback !== to) {
      result = await sendEmail(fallback, subject, body)
    }

    await service
      .from('notifications')
      .update({
        status: result.ok ? 'sent' : 'failed',
        sent_at: result.ok ? new Date().toISOString() : null,
        channel: result.channel,
        // Keeping the id here is what lets the delivery webhook find this row.
        ...(result.sid ? { payload: { ...n.payload, message_sid: result.sid } } : {}),
      })
      .eq('id', n.id)

    if (!result.ok) continue
    if (n.notif_type === 'reminder') remindersSent++
    else whatChangedSent++
  }

  return { remindersSent, whatChangedSent }
}
