import { CLAUDE_MODEL, createMessage, textOf } from '@/lib/ai/claude'
import { PRODUCT_LAW } from '@/lib/constants'

/**
 * "Chase this?" (SPEC-FINAL §4/§10) — the drafted letter behind a watch-card.
 *
 * This is the sharp end of the whole product. A referral that went quiet is
 * the thing a family finds out about a year later, and the reason they never
 * chase it is that writing the letter is somehow both trivial and impossible.
 * So the app writes it, with the reference numbers already in it, and the
 * family presses send.
 *
 * It is an administrative letter and nothing else: it asks where something has
 * got to. It never argues clinical urgency, because that is not ours to claim.
 */

export interface ChaseDraft {
  to: string
  subject: string
  body: string
}

const SYSTEM = `You draft a short, polite letter chasing an NHS appointment or result that has gone quiet, on behalf of the family member who manages the care.

${PRODUCT_LAW}

WHAT THIS LETTER IS
It asks one question — where has this got to — and gives whoever opens it everything they need to look it up without writing back for details.

RULES
- Use only what is in the source letter you are given: names, departments, consultant, hospital, NHS number, date of birth, the date of the referral or request, and any timeframe it promised. Never invent a reference number, a name or a date.
- Quote the promise back, plainly and without accusation: "your letter of 12 May said the renal team aim to see patients within six weeks".
- Say what is being asked for: an appointment date, or confirmation the referral was received.
- Say who is writing and in what capacity ("I am his daughter and I manage his appointments").
- Do NOT describe symptoms, argue that the case is urgent, or say anything about the person's condition beyond naming the referral. Whether this is clinically urgent is a judgement for a clinician, not for this letter — pressing that case would be diagnosing by the back door.
- No emotional pressure, no complaint language, no legal language. This is a first, friendly chase.
- British English. Under 180 words. Ready to send as an email or to print — so no square-bracket placeholders unless the source genuinely does not contain the detail, in which case write [ ] and keep it to a minimum.

OUTPUT
to: the department and hospital it should go to, as one line, taken from the source letter.
subject: a subject line carrying the person's name and NHS number if the letter gives one.
body: the letter itself, starting "Dear" and ending with a sign-off and the writer's name.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['to', 'subject', 'body'],
  properties: {
    to: { type: 'string' },
    subject: { type: 'string' },
    body: { type: 'string' },
  },
} as const

export interface ChaseContext {
  description: string
  expectedDate: string | null
  daysOverdue: number | null
  writerName: string
  personName: string
  sourceTranscript: string
  sourceLabel: string
}

const MAX_TRANSCRIPT = 8000

export async function draftChase(ctx: ChaseContext): Promise<ChaseDraft> {
  const overdue =
    ctx.daysOverdue && ctx.daysOverdue > 0
      ? `It is now about ${ctx.daysOverdue} days past the date it was expected by.`
      : 'It has not been heard about since.'

  const message = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 1500,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Draft the chase letter.

The writer is ${ctx.writerName}, who manages ${ctx.personName}'s care.

What has gone quiet: ${ctx.description}
${ctx.expectedDate ? `Expected by: ${ctx.expectedDate}. ${overdue}` : overdue}

This is the letter it came from (${ctx.sourceLabel}) — take the names, numbers and dates from it:

<source>
${ctx.sourceTranscript.slice(0, MAX_TRANSCRIPT)}
</source>`,
      },
    ],
  })

  const raw = textOf(message)
  let parsed: ChaseDraft
  try {
    parsed = JSON.parse(raw) as ChaseDraft
  } catch {
    throw new Error('The draft came back in a shape we could not read.')
  }

  return {
    to: (parsed.to ?? '').trim(),
    subject: (parsed.subject ?? '').trim(),
    body: (parsed.body ?? '').trim(),
  }
}
