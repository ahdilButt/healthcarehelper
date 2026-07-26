import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Ceilings on the work that costs money.
 *
 * Two AI paths spend on every request — Claude (ask, brief, translate, chase,
 * and both ingest stages) and ElevenLabs (the spoken answers). A public demo
 * link is an open invitation to both, so each needs a ceiling that survives
 * the request that set it.
 *
 * The counters live in a table because serverless has no memory: a module
 * variable resets on every cold start, so an in-process counter is not a cap,
 * it is a cap-shaped comment. `supabase/demo-mode.sql` creates the table and
 * the atomic increment.
 *
 * Deliberately no `server-only` import and its own client: `npm run ingest`
 * and `npm run test:extraction` drive the same pipeline from a script, and
 * they need to be able to turn this off (USAGE_METER_OFF) rather than spend
 * the demo's budget on a developer's test run.
 */

/** Counter names. Anything not listed is a typo, not a new budget. */
export const USAGE = {
  /** Claude spend, in millionths of a dollar (integers only in the column). */
  aiUsd: 'anthropic:usd_micros',
  /** ElevenLabs characters — what they actually bill per. */
  speechChars: 'elevenlabs:chars',
  /** Guest records provisioned by "Try it". */
  guests: 'demo:guests',
  /** Per-person paid calls, keyed by user id — see `perUserKey`. */
  perUserCalls: 'anthropic:calls',
} as const

export const perUserKey = (userId: string) => `${USAGE.perUserCalls}:${userId}`

/**
 * Budgets, all overridable in Vercel without a deploy.
 *
 * Read at call time rather than at module load, so raising a ceiling
 * mid-demo takes effect on the next request.
 */
export const budgets = () => ({
  /** Dollars of Claude spend for the whole demo. */
  aiUsd: num(process.env.DEMO_BUDGET_AI_USD, 25),
  /** The user asked for roughly this many characters of the paid voice. */
  speechChars: num(process.env.DEMO_BUDGET_SPEECH_CHARS, 5000),
  guests: num(process.env.DEMO_BUDGET_GUESTS, 200),
  /** One visitor cannot drain the pot before the next one arrives. */
  callsPerUser: num(process.env.DEMO_BUDGET_AI_CALLS_PER_USER, 40),
})

function num(raw: string | undefined, fallback: number): number {
  const n = Number(raw)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/**
 * Claude prices per million tokens (claude-opus-5, 2026-07).
 * Cache writes are the 5-minute rate, which is what `cache_control:
 * {type:'ephemeral'}` asks for everywhere in this codebase.
 */
const PRICE_PER_MTOK = {
  input: 5,
  output: 25,
  cacheWrite: 6.25,
  cacheRead: 0.5,
}

export interface ClaudeUsage {
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens?: number | null
  cache_read_input_tokens?: number | null
}

/**
 * What a Claude response cost, in millionths of a dollar.
 *
 * Counting money rather than tokens because "credits" is what the ceiling is
 * denominated in, and because an input token and an output token are five
 * times apart — a single token total would hide which one ran away.
 */
export function costMicros(usage: ClaudeUsage): number {
  const perToken = (perMTok: number) => perMTok / 1_000_000
  const dollars =
    usage.input_tokens * perToken(PRICE_PER_MTOK.input) +
    usage.output_tokens * perToken(PRICE_PER_MTOK.output) +
    (usage.cache_creation_input_tokens ?? 0) * perToken(PRICE_PER_MTOK.cacheWrite) +
    (usage.cache_read_input_tokens ?? 0) * perToken(PRICE_PER_MTOK.cacheRead)
  return Math.round(dollars * 1_000_000)
}

/** Thrown when a ceiling has been reached. Routes turn it into an envelope. */
export class BudgetError extends Error {
  constructor(readonly counter: string) {
    super(`Budget spent: ${counter}`)
    this.name = 'BudgetError'
  }
}

export const meterOff = () => process.env.USAGE_METER_OFF === 'true'

let client: SupabaseClient | null = null
let warned = false

function db(): SupabaseClient | null {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  return client
}

/**
 * Add to a counter and return the new total, or null if the counter store is
 * unreachable.
 *
 * Fails OPEN, loudly. The alternative — refusing every paid call when the
 * table is missing — turns one un-applied migration into a dead demo, and the
 * kill switch already guarantees the spend window is finite. A silent fallback
 * would be the worst of both, so the log line is not optional.
 */
async function bump(key: string, amount: number): Promise<number | null> {
  const supabase = db()
  if (!supabase) return warnOnce('no service-role key')

  const { data, error } = await supabase.rpc('bump_usage', { k: key, n: Math.round(amount) })
  if (error) return warnOnce(error.message)
  return Number(data)
}

function warnOnce(reason: string): null {
  if (!warned) {
    warned = true
    console.error(
      `[usage] counter store unavailable (${reason}) — SPEND IS UNCAPPED. ` +
        'Apply supabase/demo-mode.sql, then run: npm run demo:check'
    )
  }
  return null
}

/** Current value of a counter. Null means the store could not be read. */
export async function used(key: string): Promise<number | null> {
  const supabase = db()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('usage_counters')
    .select('used')
    .eq('key', key)
    .maybeSingle()
  if (error) return null
  return Number(data?.used ?? 0)
}

/**
 * Refuse before spending. Used where the cost is only known afterwards
 * (Claude): the ceiling can be overshot by at most one call, which is the
 * price of not making the model quote first.
 */
export async function assertBudget(key: string, budget: number): Promise<void> {
  if (meterOff()) return
  const spent = await used(key)
  if (spent !== null && spent >= budget) throw new BudgetError(key)
}

/** Record a spend after the fact. */
export async function record(key: string, amount: number): Promise<void> {
  if (meterOff() || amount <= 0) return
  await bump(key, amount)
}

/** Put back a reservation the caller turned out not to spend. */
export async function refund(key: string, amount: number): Promise<void> {
  if (meterOff() || amount <= 0) return
  await bump(key, -amount)
}

/**
 * Take the amount out of the budget first, and put it back if that pushed us
 * over. Used where the size is known up front (characters of speech, one more
 * guest record), so the ceiling holds exactly rather than approximately.
 */
export async function reserve(key: string, amount: number, budget: number): Promise<boolean> {
  if (meterOff()) return true
  const total = await bump(key, amount)
  if (total === null) return true // store unreachable — already logged
  if (total <= budget) return true
  await bump(key, -amount)
  return false
}

/**
 * Charge one paid call to whoever asked for it.
 *
 * The global ceiling protects the card; this protects the next visitor. A
 * public link means one person with time on their hands could otherwise spend
 * the whole budget before anyone else opens it.
 */
export async function chargeUserCall(userId: string): Promise<void> {
  const key = perUserKey(userId)
  if (!(await reserve(key, 1, budgets().callsPerUser))) throw new BudgetError(key)
}
