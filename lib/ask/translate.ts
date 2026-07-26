import { CLAUDE_MODEL, createMessage, textOf } from '@/lib/ai/claude'
import { PRODUCT_LAW } from '@/lib/constants'

/**
 * "What this letter says" (SPEC-FINAL §4) — one letter, three plain answers.
 *
 * The three headings are the questions a family actually has when an NHS
 * envelope lands, in the order they have them. Nothing here is advice: it is
 * the letter, in words that do not need a clinician to unpack them.
 */

export interface Translation {
  whatItSays: string
  whatChanged: string
  whatHappensNext: string
}

const SYSTEM = `You put one NHS letter into plain English for the family who received it.

${PRODUCT_LAW}

Answer three things about THIS letter and nothing else:

what_it_says — what the letter is telling them, in two to four short sentences. Lead with the thing that matters most to a family, not with the letter's own opening. Explain any clinical word the moment you use it ("ejection fraction — how much blood the heart pushes out with each beat").

what_changed — what is different because of this letter: a medicine started, stopped or moved; a diagnosis named for the first time; a result that the letter itself compares to a previous one. Quote doses and numbers exactly. If nothing changed, say "Nothing changed with this one" and stop.

what_happens_next — what the letter says will happen, who is doing it, and by when. Include anything the family has to do themselves. If the letter promises something without a date, say that plainly ("they say they will write, but they do not say when"). If it asks nothing of anyone, say so.

Rules that override everything: do not say whether any of it is good or bad news. Do not say what the numbers mean for their health. Do not suggest, encourage or discourage any change to what they take or do — not even continuing something. Where the letter itself gives an instruction, report it as the letter's instruction ("the clinic asks him to have a blood test in two weeks"), never as yours.

Warm, calm, short sentences. No bullet points, no headings inside the answers.`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['what_it_says', 'what_changed', 'what_happens_next'],
  properties: {
    what_it_says: { type: 'string' },
    what_changed: { type: 'string' },
    what_happens_next: { type: 'string' },
  },
} as const

export async function translateLetter(transcript: string): Promise<Translation> {
  const message = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Put this letter into plain English.\n\n<letter>\n${transcript}\n</letter>`,
      },
    ],
  })

  const raw = textOf(message)
  let parsed: { what_it_says: string; what_changed: string; what_happens_next: string }
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('The plain-English version came back in a shape we could not read.')
  }

  return {
    whatItSays: (parsed.what_it_says ?? '').trim(),
    whatChanged: (parsed.what_changed ?? '').trim(),
    whatHappensNext: (parsed.what_happens_next ?? '').trim(),
  }
}
