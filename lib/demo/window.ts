/**
 * When the public demo stops.
 *
 * The whole switch is one environment variable — `DEMO_CLOSES_AT`, an ISO
 * instant. Editing it in Vercel opens or closes the demo on the next request,
 * with no deploy, no cron and no third service to remember to turn off. That
 * reversibility is the point: a kill switch you cannot un-kill during a
 * hackathon is a worse bet than the thing it protects against.
 *
 * Deliberately dependency-free. `proxy.ts` imports this, and Next runs the
 * proxy outside the application's runtime — anything with a `server-only`
 * import or a database handle does not belong in here.
 */

export interface DemoWindow {
  /** null when no closing time is configured — the demo stays open. */
  closesAt: Date | null
  closed: boolean
  /** null when open-ended; otherwise milliseconds left, floored at zero. */
  msRemaining: number | null
}

let warned = false

export function demoWindow(now: Date = new Date()): DemoWindow {
  const raw = process.env.DEMO_CLOSES_AT?.trim()
  if (!raw) return { closesAt: null, closed: false, msRemaining: null }

  const closesAt = new Date(raw)
  if (Number.isNaN(closesAt.getTime())) {
    // A typo here must not close the demo by accident, so it fails open —
    // loudly, because silently ignoring the kill switch is the other failure.
    if (!warned) {
      warned = true
      console.error(`[demo] DEMO_CLOSES_AT is not a date I can read: ${raw} — demo stays open`)
    }
    return { closesAt: null, closed: false, msRemaining: null }
  }

  const msRemaining = Math.max(0, closesAt.getTime() - now.getTime())
  return { closesAt, closed: msRemaining === 0, msRemaining }
}
