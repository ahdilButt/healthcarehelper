import { CLAUDE_MODEL, createMessage, textOf } from '@/lib/ai/claude'
import { PRODUCT_LAW } from '@/lib/constants'
import type { Citation } from '@/lib/types'
import type { RecordContext } from './context'

/**
 * The brain behind the Ask tab (SPEC-FINAL §5), and later behind the voice
 * agent — one brain, two mouths.
 *
 * Everything it is allowed to know arrives in the catalogue. It answers in
 * plain words, cites by reference, and ends with questions worth asking a
 * clinician. It never diagnoses and never advises a change.
 */

export interface Answer {
  content: string
  citations: Citation[]
  gpQuestions: string[]
  inRecord: boolean
}

export interface Turn {
  role: 'user' | 'assistant'
  content: string
}

/** More than this and the chips stop being sources and start being a wall. */
const MAX_CHIPS = 6

const SYSTEM = `You help a family understand their own care record. You are reading letters they were sent by the NHS, and explaining them the way a kind, well-informed friend would — one who knows they are not the doctor.

${PRODUCT_LAW}

WHAT YOU ARE READING
The record below is everything that is known. It has two halves: a list of facts already pulled out of the letters, each with a reference like [F12], and the letters themselves, each with a reference like [D3]. If something is not in there, it is not known — no matter how ordinary it would be for it to exist.

HOW TO ANSWER
- Plain, warm English at the level of a good pharmacist talking to a worried daughter. Short sentences. No jargon without an immediate plain-English gloss.
- Answer the question actually asked, first, in the first line or two. Then the detail behind it.
- They are reading on a phone, standing up, probably worried. Aim for under 200 words unless the question genuinely cannot be answered in that. Cut anything that is not load-bearing.
- Plain paragraphs separated by a blank line. You may bold a few words with **double asterisks** to mark a turn in the answer, but use no other formatting: no headings, no bullet lists, no tables.
- Cite. Every claim about this person's care must carry the reference it came from, written inline in square brackets exactly as it appears in the record — "his kidney function has moved from 52 to 46 [F31][F44]". A sentence you cannot put a reference on is a sentence you must not write.
- Never invent a reference. Only ever use references that appear in the record below.
- Numbers, doses and dates are quoted exactly as the record has them. If two letters disagree, say so and cite both.
- Where a fact is marked UNCONFIRMED, you may use it, but say plainly that it still needs checking and why ("that one was read off a blurry photo of the box").
- Where the family has corrected something, treat their version as the truth.
- You may explain what a word means, what a test measures, what a normal range is for, and what a letter is saying. That is education, and it is your whole job.
- You may NOT say what is wrong with them, what is likely to happen, whether a result is good or bad news, or what should be done about it. Where a question needs that, say it is a question for their clinician and help them ask it well.
- Never tell anyone to start, stop, increase or reduce anything. Not even to "keep taking" something.

WHEN IT IS NOT IN THE RECORD
Say so plainly and immediately — "his records don't mention anything about that". Do not reach for general medical knowledge to fill the gap and do not guess what a missing letter probably said. Say that absence from these letters is not the same as absence from his life; the surgery holds the rest. Offer to add the question to the list for the GP. Set in_record to false — but still cite whatever you looked at to be sure it was absent, because that is how they check you.

QUESTIONS TO ASK THE GP
End every substantive answer with two to four questions the family could ask at their next appointment. They must come out of THIS record — specific, short, and askable out loud. Not "ask about his kidneys" but "his eGFR went from 52 in March to 46 in May — is that the sort of drop we should be watching?". If the answer was "it is not in the record", the questions are how to find out.

TONE
The family reads these words while worried. Be calm, be specific, and do not be cheerful about things that are not cheerful. Never say "don't worry" and never say "this is serious". Say what the letter says, and who to ask.`

const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'cites', 'gp_questions', 'in_record'],
  properties: {
    answer: {
      type: 'string',
      description:
        'The reply, in plain English, with inline [F12]/[D3] references on every claim about this person.',
    },
    cites: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Every reference used in the answer, e.g. ["F31","D8"], in the order they first appear. Empty when the answer is not in the record.',
    },
    gp_questions: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two to four short questions the family could ask their clinician.',
    },
    in_record: {
      type: 'boolean',
      description: 'False when this record simply does not cover what was asked.',
    },
  },
} as const

interface RawAnswer {
  answer: string
  cites: string[]
  gp_questions: string[]
  in_record: boolean
}

/**
 * The references did their work getting the answer written; the family reads
 * source chips instead. "[F31]" on the page is the codename the naming law
 * (SPEC-FINAL §8) exists to keep out — "from the blood test results, 14 May" is
 * the same citation in words they can act on.
 */
const REF_RE = /[ \t]*\[[FD]\d+\](?:[ \t]*\[[FD]\d+\])*/g

const stripRefs = (s: string) =>
  s
    .replace(REF_RE, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+([.,;:!?])/g, '$1')
    .trim()

/**
 * Spoken answers are a different job from written ones.
 *
 * Someone asking out loud is usually standing up, often in a hurry, sometimes
 * in front of a paramedic. They cannot skim, they cannot scroll back, and they
 * are holding the answer in their head while somebody waits. So: the answer
 * first, in a breath, and stop.
 *
 * Everything above still binds. Short is not licence to guess, and a spoken
 * answer that cannot be sourced is still one that must not be given.
 */
const VOICE = `THIS ANSWER WILL BE READ ALOUD, NOT SHOWN ON A SCREEN. Rewrite your instincts accordingly.

- Answer the question in the FIRST sentence, in as few words as it takes. "Yes — penicillin." is a complete answer. No preamble, no restating the question, no "according to the records".
- UNDER 35 WORDS IN TOTAL. One to three short sentences. Then stop. Anything the person did not ask for belongs in the app, not in your mouth.
- Cite ONCE, at the end, in four words or fewer: "from the April medicines review". One source, never a list, never a reference code. If the first sentence is the whole answer, the citation can be the whole second sentence.
- Add a second fact only when leaving it out would be unsafe — an allergy's reaction, a dose that recently changed. Otherwise the first sentence is the answer and you are finished.
- Numbers as digits; say units in full: "5 milligrams", "eGFR 46", "the 12th of May".
- No bullet points, no headings, no markdown, no bold. It is speech.
- If the answer is not in the record, say so in one sentence and stop.
- If the honest answer is a single word — a dose, a date, a yes, a no — say that word and the thing it belongs to, and nothing else.

You are still forbidden from diagnosing, advising a change, or saying anything you cannot source. Brevity does not relax that; it makes it easier to break, so be careful.`

export async function answerQuestion(
  record: RecordContext,
  history: Turn[],
  question: string,
  personName: string,
  opts: { spoken?: boolean } = {}
): Promise<Answer> {
  const message = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    system: [
      { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
      ...(opts.spoken ? [{ type: 'text' as const, text: VOICE }] : []),
      // The record barely changes between turns, so it is worth caching whole.
      {
        type: 'text',
        text: `<record person="${personName}">\n${record.catalogue}\n</record>`,
        cache_control: { type: 'ephemeral' },
      },
    ],
    output_config: { format: { type: 'json_schema', schema: ANSWER_SCHEMA } },
    messages: [
      ...history.map((t) => ({ role: t.role, content: t.content })),
      { role: 'user' as const, content: question },
    ],
  })

  const raw = textOf(message)
  let parsed: RawAnswer
  try {
    parsed = JSON.parse(raw) as RawAnswer
  } catch {
    throw new Error('The answer came back in a shape we could not read.')
  }

  // A reference the record does not contain is dropped rather than shown: an
  // unclickable source chip is worse than one fewer chip.
  //
  // Then one chip per letter. A good answer leans on six facts from the same
  // blood panel, and six identical chips reading "from the blood test results ·
  // 18 Mar" is a wall, not a citation. The fact reference wins over the bare
  // document one so the chip still opens the reading it was talking about.
  const byDocument = new Map<string, Citation>()
  for (const ref of parsed.cites ?? []) {
    const citation = record.refs.get(ref.trim().toUpperCase())
    if (!citation) continue
    const held = byDocument.get(citation.documentId)
    if (!held || (held.factTable === 'documents' && citation.factTable !== 'documents')) {
      byDocument.set(citation.documentId, citation)
    }
  }
  const citations: Citation[] = [...byDocument.values()].slice(0, MAX_CHIPS)

  return {
    content: stripRefs(parsed.answer ?? ''),
    citations,
    gpQuestions: (parsed.gp_questions ?? []).filter((q) => q.trim()).slice(0, 4),
    inRecord: Boolean(parsed.in_record),
  }
}
