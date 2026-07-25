import { CLAUDE_MODEL, claude, textOf } from '@/lib/ai/claude'
import { CONFIRMED_THRESHOLD, PRODUCT_LAW } from '@/lib/constants'
import { EXTRACTION_JSON_SCHEMA, extractedFactsSchema, type ExtractedFacts } from './schema'
import type { Legibility } from './stage-a'

/**
 * STAGE B — extract.
 *
 * A text call over Stage A's transcript that produces structured facts with a
 * calibrated confidence on every one. Separate from Stage A so each stage is
 * independently testable against the fixtures (SPEC-FINAL §3).
 */

const SYSTEM = `You read a transcript of one UK medical document and extract the facts it contains, for a family's private care record.

${PRODUCT_LAW}

Extract ONLY what this document actually states. You are not summarising a patient; you are recording what one letter says.

WHAT COUNTS AS PRESENT
- A letter that lists a medicine at a dose records that medicine. A letter that says "continue his usual medications" records NOTHING — there is no medicine named.
- A letter that mentions a condition as background history does record that condition.
- Record a result only where the document gives a value. Reference ranges belong to the result they sit beside.
- A result does not have to be a number. Scan and imaging reports state findings in words — "mild mitral regurgitation", "no acute changes", "trileaflet aortic valve, no stenosis". Record each as a result using value_text. Record the report's overall conclusion or impression as a result too, named for the study ("Echocardiogram conclusion", "Chest X-ray report"), because that headline sentence is the thing the family actually wants to read. If the report also names a diagnosis, it can appear as a condition as well.
- flagged: true ONLY where the document ITSELF marks the value abnormal (an H/L marker, an asterisk, a sentence calling it low or raised). Never decide a value is abnormal yourself — that is a clinician's judgement, not yours.

MEDICINES
- current_dose is the dose this document says the person takes NOW, e.g. "5mg once daily".
- Set change.old_dose only when the document states a previous dose, e.g. "increased from 2.5 mg to 5 mg".
- Set is_active false when the document STOPS the medicine.
- rotation_sites only for patches or gels where the document names the sites to rotate between.

OPEN LOOPS — things left hanging that someone must chase
- referral: a referral made, awaiting an appointment.
- test: a test or blood check that has been asked for.
- letter: a promise to write, e.g. "we will write within three weeks".
- follow_up: something to watch or come back to.
- expected_date: compute it when the document gives a timeframe. "within six weeks" in a letter dated 12 May 2026 means 2026-06-23. Leave null when no timeframe is given.

CONFIDENCE — this is the most important field you produce
Confidence is how certain YOU are that you read this correctly from THIS transcript. It is not how plausible the fact is.
- 0.95-1.0: printed plainly and unambiguously.
- 0.80-0.94: clear, but the wording leaves a little room.
- Below 0.80: genuinely uncertain — the transcript shows [unclear], the text is a handwritten annotation, the number could be misread, or you are inferring rather than reading.
Anything below 0.80 is shown to the family as "unconfirmed" and is kept out of shared summaries and alerts until a human confirms it. So be honest: a blurred or handwritten value MUST score below 0.80. Do not round your uncertainty away.

HANDWRITING IS ALWAYS UNCERTAIN
Anything the transcript marks [handwritten] scores BELOW 0.80, however confident the words look. Handwriting is read, not printed, and a biro note on a form has no authority behind it — a human must confirm it before it counts. This holds even when the rest of the page is pristine.

A handwritten annotation querying a dose is NOT a dose change. Record it as an open loop to check with the clinician, not as a new medicine dose.

APPOINTMENTS WITHOUT A DATE
A named future clinic or review IS an appointment even when no date is given — "I will see him again in October", "follow-up in about eight weeks", "he will be sent an appointment for the renal clinic". Record it with starts_at null. Only set starts_at when the document gives an actual date, and include the time when it gives one.

human_title is what a family member would call this document — "Heart clinic letter", "Blood test results", "Hospital stay summary". Never jargon, never a document reference.

If the document contains nothing of a given kind, return an empty array for it.`

/**
 * How the source looked, turned into an instruction. Stage B cannot see the
 * photograph, so a clean sentence lifted off a blurred label would otherwise
 * score as confidently as one off a crisp PDF.
 */
const LEGIBILITY_NOTE: Record<Legibility, string> = {
  clear: 'SOURCE LEGIBILITY: clear. This came from a sharp original, so score normally.',
  degraded: `SOURCE LEGIBILITY: degraded. This transcript was read off a photograph whose small print needed care. The words below read cleanly because the transcriber tidied them up, so judge each fact on where it sat on the page: anything that would have been small print, handwritten, or marked [unclear] scores below 0.80, while a clearly printed headline value — a drug name and strength in a table or a large label — may still score normally.`,
  poor: `SOURCE LEGIBILITY: poor. This transcript was reconstructed from a barely readable image. Score EVERY fact below 0.80. The family needs to check all of it against the original.`,
}

export async function extractFacts(
  transcript: string,
  legibility: Legibility = 'clear'
): Promise<ExtractedFacts> {
  const message = await claude().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    output_config: {
      effort: 'high',
      format: { type: 'json_schema', schema: EXTRACTION_JSON_SCHEMA },
    },
    messages: [
      {
        role: 'user',
        content: `${LEGIBILITY_NOTE[legibility]}\n\nExtract the facts from this document transcript.\n\n<transcript>\n${transcript}\n</transcript>`,
      },
    ],
  })

  const raw = textOf(message)
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`Stage B returned unparseable JSON (${raw.slice(0, 200)}…)`)
  }
  return extractedFactsSchema.parse(parsed)
}

/** A fact is confirmed when it was read confidently, or a human has said so. */
export const isConfirmed = (confidence: number, confirmedAt: string | null | undefined) =>
  confidence >= CONFIRMED_THRESHOLD || Boolean(confirmedAt)
