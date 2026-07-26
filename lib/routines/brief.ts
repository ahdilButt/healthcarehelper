import type { SupabaseClient } from '@supabase/supabase-js'
import { CLAUDE_MODEL, createMessage, textOf } from '@/lib/ai/claude'
import { PRODUCT_LAW } from '@/lib/constants'
import { applyCorrections, correctionsForPerson, factKey, isConfirmed } from '@/lib/facts/read'
import { buildToday } from './today'
import { londonDate, londonInstant, humanTime } from './time'

/**
 * The line at the top of Today (SPEC-FINAL §6).
 *
 * It reads their own day back to them — what is left to take, what is booked,
 * what is coming. It never tells anyone to take anything: the schedule came
 * out of their letters, and repeating it is not the same as advising it.
 *
 * The facts are counted here, in code. Claude only turns the counts into one
 * warm sentence, so the numbers on screen can never be a hallucination.
 */

export interface TodayBrief {
  sentence: string
  diary: string
  remaining: number
  total: number
}

interface AppointmentRow {
  id: string
  title: string
  location: string | null
  starts_at: string | null
  confidence: number
  confirmed_at: string | null
}

const WEEK_DAYS = 7

export async function buildBrief(
  db: SupabaseClient,
  personId: string,
  personName: string,
  now = new Date()
): Promise<TodayBrief> {
  const today = londonDate(now)
  const [{ groups }, { data: appts }, corrections] = await Promise.all([
    buildToday(db, personId, today),
    db.from('appointments').select('*').eq('person_id', personId),
    correctionsForPerson(db, personId),
  ])

  const due = [...groups.morning, ...groups.afternoon, ...groups.evening]
  const remaining = due.filter((d) => !d.taken)
  const nextUp = remaining[0]

  const startOfDay = londonInstant(today, '00:00').getTime()
  const endOfDay = londonInstant(today, '23:59').getTime()
  const endOfWeek = endOfDay + WEEK_DAYS * 86400000

  const upcoming = ((appts ?? []) as AppointmentRow[])
    .filter((a) => isConfirmed(Number(a.confidence), a.confirmed_at))
    .map((a) => applyCorrections(a, corrections.get(factKey('appointments', a.id))))
    .filter((a) => a.starts_at)
    .map((a) => ({ ...a, at: new Date(a.starts_at as string).getTime() }))
    .filter((a) => Number.isFinite(a.at) && a.at >= startOfDay && a.at <= endOfWeek)
    .sort((a, b) => a.at - b.at)

  const todayAppt = upcoming.find((a) => a.at <= endOfDay)
  const laterAppt = upcoming.find((a) => a.at > endOfDay)

  const diary = todayAppt
    ? `${todayAppt.title} today at ${humanTime(londonClockOf(new Date(todayAppt.at)))}${
        todayAppt.location ? ` · ${todayAppt.location}` : ''
      }`
    : laterAppt
      ? `Nothing today. Next: ${laterAppt.title} on ${dayName(new Date(laterAppt.at))}`
      : 'No appointments today, and none in the next week.'

  const sentence = await oneSentence({
    personName,
    total: due.length,
    remaining: remaining.length,
    nextName: nextUp?.humanName ?? null,
    nextDose: nextUp?.dose ?? null,
    nextAt: nextUp ? humanTime(londonClockOf(new Date(nextUp.dueAt))) : null,
    patchSite: due.find((d) => d.form === 'patch' && !d.taken)?.site?.next ?? null,
    diary,
  })

  return { sentence, diary, remaining: remaining.length, total: due.length }
}

const londonClockOf = (at: Date) =>
  at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London', hour12: false })

const dayName = (at: Date) =>
  at.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' })

interface Counts {
  personName: string
  total: number
  remaining: number
  nextName: string | null
  nextDose: string | null
  nextAt: string | null
  patchSite: string | null
  diary: string
}

const SYSTEM = `You write ONE sentence at the top of a family's "Today" screen, summing up the day for the person they care for.

${PRODUCT_LAW}

You are given counts that are already true. Use them; never invent a number, a medicine or an appointment that is not in them.

- One sentence, ending in a full stop. Between 10 and 25 words. Warm, plain, calm.
- Say what is left today AND name the next one with its time — "…starting with the ramipril at 8am". A bare count is not useful; the next thing is what someone acts on.
- If everything is done, say so warmly and stop — do not invent a task.
- Use the person's name once, naturally. Never "the patient".
- Do NOT instruct anyone to take, start, stop or change anything. Report the day, do not prescribe it. "Three left to take, starting with the ramipril at 8am" reports; "take his ramipril" prescribes.
- No greeting, no emoji, no exclamation marks, no "don't worry".`

async function oneSentence(c: Counts): Promise<string> {
  const fallback =
    c.total === 0
      ? `Nothing is scheduled for ${c.personName} today.`
      : c.remaining === 0
        ? `Everything is ticked off for ${c.personName} today.`
        : `${c.remaining} of ${c.total} still to take${c.nextAt ? `, next at ${c.nextAt}` : ''}.`

  try {
    const message = await createMessage({
      model: CLAUDE_MODEL,
      // One sentence from counts that are already true needs no deliberation,
      // and a small budget spent thinking leaves no budget to answer with —
      // which returns an empty text block and looks exactly like a failure.
      max_tokens: 700,
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: `Person: ${c.personName}
Medicines due today: ${c.total}
Still to take: ${c.remaining}
Next one: ${c.nextName ? `${c.nextName} ${c.nextDose} at ${c.nextAt}` : 'none'}
Patch site for today: ${c.patchSite ?? 'not applicable'}
Diary: ${c.diary}

Write the sentence.`,
        },
      ],
    })
    const said = textOf(message).trim().replace(/^["“]|["”]$/g, '')
    return said || fallback
  } catch (e) {
    // The screen is more important than the sentence — but a silent fallback
    // looks identical to a working one, so say why in the log.
    console.error('[brief] falling back:', e instanceof Error ? e.message : e)
    return fallback
  }
}
