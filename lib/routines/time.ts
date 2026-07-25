import { APP_TIMEZONE } from '@/lib/constants'

/**
 * Local time, done properly, without a date library.
 *
 * Every routine time in this app is a wall-clock time in the family's day —
 * "08:00" means eight in the morning where they live, and it has to keep
 * meaning that through the March and October clock changes. A reminder that
 * arrives an hour early for half the year is a reminder nobody trusts.
 */

const PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIMEZONE,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function readParts(at: Date): Record<string, number> {
  const out: Record<string, number> = {}
  for (const p of PARTS.formatToParts(at)) {
    if (p.type !== 'literal') out[p.type] = Number(p.value)
  }
  // 24:00 is midnight of the same day in some ICU builds.
  if (out.hour === 24) out.hour = 0
  return out
}

/** Minutes London is ahead of UTC at this instant. */
function offsetMinutes(at: Date): number {
  const p = readParts(at)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return (asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000
}

/** "2026-07-25" — today, where the family is, not where the server is. */
export function londonDate(at: Date = new Date()): string {
  const p = readParts(at)
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`
}

/** The instant at which a wall-clock time on a given day actually happens. */
export function londonInstant(date: string, hhmm: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  const naive = Date.UTC(y, m - 1, d, hh, mm)
  // Two passes: the first offset is read at the wrong instant on the two days
  // a year the clocks move, and the second lands on the right side of it.
  const once = naive - offsetMinutes(new Date(naive)) * 60000
  return new Date(naive - offsetMinutes(new Date(once)) * 60000)
}

/** "08:00" for an instant, in the family's day. */
export function londonClock(at: Date): string {
  const p = readParts(at)
  return `${pad(p.hour)}:${pad(p.minute)}`
}

export type PartOfDay = 'morning' | 'afternoon' | 'evening'

/** SPEC-FINAL §6 groups Today into three parts of a day, not into hours. */
export function partOfDay(hhmm: string): PartOfDay {
  const hour = Number(hhmm.slice(0, 2))
  if (hour < 12) return 'morning'
  if (hour < 18) return 'afternoon'
  return 'evening'
}

/** "8:00 in the morning" reads wrong; "8:00am" is what a phone shows. */
export function humanTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const hour = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${hour}${suffix}` : `${hour}:${pad(m)}${suffix}`
}

const pad = (n: number) => String(n).padStart(2, '0')

export const isValidTime = (v: unknown): v is string =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)
