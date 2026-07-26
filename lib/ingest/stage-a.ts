import type Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODEL, createMessage, mediaTypeFor, textOf } from '@/lib/ai/claude'
import { PRODUCT_LAW } from '@/lib/constants'

/**
 * STAGE A — transcribe.
 *
 * A vision call that turns the original into a full plain transcript. The
 * transcript is first-class, not a means to an end: it feeds Ask, it backs
 * every citation, and it is what a human reads when they want to check what
 * the machine actually saw.
 */

const SYSTEM = `You transcribe photographs and scans of UK medical documents for a family's private care record.

${PRODUCT_LAW}

Your job here is ONLY to transcribe. Do not summarise, do not interpret, do not add anything that is not on the page.

FIRST LINE — always, before anything else, output exactly one line:
LEGIBILITY: clear
LEGIBILITY: degraded
LEGIBILITY: poor
Judge it by the SMALLEST print on the page, not the headline, and by the image itself rather than how confident you feel about the words:
- clear: a sharp scan or a well-lit photo. Even the small print is crisp and effortless. A page can be skewed or shadowed and still be clear if the characters are sharp.
- degraded: mostly readable, but a few passages of small print needed care or a second look.
- poor: heavily blurred, very dark or obscured. Small print is largely illegible and you are reconstructing characters from context rather than seeing them.
This line decides whether the app asks a human to double-check, so both mistakes cost: rating a crisp page "poor" buries good facts under warnings nobody reads, and rating a blurred one "clear" puts an unchecked number into someone's medical record.

Then the transcript itself.

Rules:
- Reproduce the text in reading order: letterhead, addresses, reference lines, date, salutation, body, tables, sign-off, cc lines, footers.
- Preserve numbers, units and doses EXACTLY as printed. "2.5 mg" is not "2.5mg" is not "25 mg" — copy what is there, character for character.
- Render tables as plain rows with columns separated by "  |  ", keeping the header row.
- Mark a handwritten annotation inline as: [handwritten] the text
- If a word or number is genuinely unreadable, write [unclear] rather than guessing. A guess in a medical record is worse than a gap.
- If the page is blank or nothing is legible at all, reply with exactly: UNREADABLE
- Output the transcript alone. No preamble, no commentary, no markdown fences.`

/**
 * How good the original actually looked.
 *
 * This is the channel that carries uncertainty across the stage boundary.
 * Stage B only ever sees text, so without it a blurred medicine box yields a
 * clean-looking transcript and Stage B — quite reasonably — scores it 0.97.
 * The photograph, not the sentence, is what was ambiguous.
 */
export type Legibility = 'clear' | 'degraded' | 'poor'

export interface StageAResult {
  transcript: string
  readable: boolean
  legibility: Legibility
}

const LEGIBILITY_RE = /^\s*LEGIBILITY:\s*(clear|degraded|poor)\s*$/im

function splitLegibility(raw: string): { transcript: string; legibility: Legibility } {
  const match = raw.match(LEGIBILITY_RE)
  const legibility = (match?.[1]?.toLowerCase() as Legibility) ?? 'clear'
  const transcript = raw.replace(LEGIBILITY_RE, '').trim()
  return { transcript, legibility }
}

export async function transcribe(
  file: Uint8Array,
  filename: string,
  opts: { hintedTranscript?: string | null } = {}
): Promise<StageAResult> {
  const mediaType = mediaTypeFor(filename)

  // Voice notes arrive with a transcript already (the recorder captures it on
  // device). Text artefacts are their own transcript. Neither needs vision.
  if (opts.hintedTranscript?.trim()) {
    return { transcript: opts.hintedTranscript.trim(), readable: true, legibility: 'clear' }
  }
  if (mediaType === 'text/plain') {
    const text = new TextDecoder().decode(file).trim()
    return { transcript: text, readable: text.length > 0, legibility: 'clear' }
  }

  const data = Buffer.from(file).toString('base64')
  const source: Anthropic.ContentBlockParam =
    mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
      : {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
            data,
          },
        }

  const message = await createMessage({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    // Transcription is careful copying, not reasoning — medium effort is the
    // right trade here and keeps a 15-document ingest affordable.
    output_config: { effort: 'medium' },
    messages: [
      {
        role: 'user',
        content: [source, { type: 'text', text: 'Transcribe this document.' }],
      },
    ],
  })

  const { transcript, legibility } = splitLegibility(textOf(message))
  const readable = transcript.length > 0 && transcript.trim().toUpperCase() !== 'UNREADABLE'
  return { transcript, readable, legibility }
}
