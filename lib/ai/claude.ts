import Anthropic from '@anthropic-ai/sdk'
import { USAGE, assertBudget, budgets, costMicros, record } from '@/lib/usage/meter'

/**
 * One Claude client for the whole app.
 *
 * Model choice is deliberate and central: everything user-facing in this
 * product is a reading-comprehension task over someone's medical
 * correspondence, where a misread dose matters.
 */
export const CLAUDE_MODEL = 'claude-opus-5'

let client: Anthropic | null = null

/** Private on purpose — see createMessage: one metered way in, or no ceiling. */
function claude(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
    client = new Anthropic({ apiKey, maxRetries: 3 })
  }
  return client
}

/**
 * Every Claude call in the app goes through here, so the demo's spend has one
 * ceiling rather than six.
 *
 * The check is before and the charge is after, because the cost of a call is
 * only known once it has been made. That allows an overshoot of one call —
 * accepted deliberately: the alternative is asking the model to quote first,
 * which costs a call.
 */
export async function createMessage(
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  await assertBudget(USAGE.aiUsd, budgets().aiUsd * 1_000_000)
  const message = await claude().messages.create(params)
  await record(USAGE.aiUsd, costMicros(message.usage))
  return message
}

/** Raised when Claude's safety classifiers decline a request. */
export class RefusalError extends Error {
  constructor(readonly category: string | null) {
    super(`Claude declined this request${category ? ` (${category})` : ''}`)
    this.name = 'RefusalError'
  }
}

/**
 * Pull the plain text out of a response, after checking stop_reason.
 *
 * A refusal returns HTTP 200 with an empty or partial `content`, so code that
 * indexes content[0] breaks on it — this is the guard for that.
 */
export function textOf(message: Anthropic.Message): string {
  if (message.stop_reason === 'refusal') {
    throw new RefusalError(message.stop_details?.category ?? null)
  }
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

export const mediaTypeFor = (path: string): string => {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase()
  return (
    {
      '.pdf': 'application/pdf',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.txt': 'text/plain',
    }[ext] ?? 'application/octet-stream'
  )
}
