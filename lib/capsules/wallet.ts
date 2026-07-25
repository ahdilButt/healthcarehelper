import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { CapsulePayload } from './build'

/**
 * The printable wallet card (SPEC-FINAL §7).
 *
 * Card-sized rather than A4 because the point of it is to be cut out and
 * carried: the thing that gets read is the thing in the wallet when the phone
 * is locked, flat, or in a bag in another room.
 */

const WIDTH = 243 // 85.6mm at 72dpi — a bank card
const HEIGHT = 153 // 53.98mm
const MARGIN = 12

const INK = rgb(0.07, 0.07, 0.07)
const QUIET = rgb(0.42, 0.42, 0.42)
const RULE = rgb(0.85, 0.85, 0.85)
const ALERT = rgb(0.68, 0.13, 0.09)

export async function walletPdf(payload: CapsulePayload, url: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([WIDTH, HEIGHT])
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const plain = await pdf.embedFont(StandardFonts.Helvetica)

  let y = HEIGHT - MARGIN

  const line = (text: string, size: number, font = plain, colour = INK) => {
    for (const part of wrap(text, font, size, WIDTH - MARGIN * 2)) {
      y -= size + 1.5
      page.drawText(part, { x: MARGIN, y, size, font, color: colour })
    }
  }

  const rule = () => {
    y -= 4
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: WIDTH - MARGIN, y },
      thickness: 0.5,
      color: RULE,
    })
    y -= 2
  }

  line(payload.personName, 11, bold)
  line('Emergency medical card', 6.5, plain, QUIET)
  rule()

  const section = (heading: string, items: string[], colour = INK) => {
    if (!items.length) return
    y -= 2
    line(heading.toUpperCase(), 5.5, bold, QUIET)
    for (const item of items) line(item, 6.5, plain, colour)
  }

  const find = (heading: string) => payload.sections.find((s) => s.heading === heading)
  const allergies = find('Allergies')
  section(
    'Allergies',
    allergies?.lines.length
      ? allergies.lines.map((l) => [l.text, l.note].filter(Boolean).join(' — '))
      : ['None recorded'],
    allergies?.lines.length ? ALERT : QUIET
  )

  section('Medicines', find('Current medicines')?.lines.map((l) => l.text) ?? [])
  section('Problems', find('Active problems')?.lines.map((l) => l.text) ?? [])

  section(
    'DNACPR',
    [payload.dnr == null ? 'Not recorded — check the clinical record' : payload.dnr ? 'RECORDED' : 'None recorded'],
    payload.dnr ? ALERT : QUIET
  )
  if (payload.emergencyContact?.name) {
    const c = payload.emergencyContact
    section('In an emergency call', [
      `${c.name}${c.relationship ? ` (${c.relationship})` : ''} ${c.phone ?? ''}`.trim(),
    ])
  }

  // Always the last line, and always present: the card is a summary, the link
  // is the record, and whoever is holding this needs to know that.
  page.drawText(`Full record: ${url}`, {
    x: MARGIN,
    y: MARGIN - 4,
    size: 5,
    font: plain,
    color: QUIET,
  })

  return pdf.save()
}

/** Naive greedy wrap — the card has no room for anything cleverer. */
function wrap(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  max: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(next, size) <= max) current = next
    else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}
