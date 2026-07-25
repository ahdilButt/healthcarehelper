import { PDFDocument, StandardFonts, type PDFFont } from 'pdf-lib'
import { PAGE_H, PAGE_W, type Artefact, type LaidOutPage, type LayoutItem, type Weight } from './types'

/**
 * One layout engine, two backends. Positions are computed once here using
 * Helvetica metrics so the PDF and the "photographed" PNG of the same
 * document are pixel-for-pixel the same letter.
 *
 * Coordinates are PDF-style: origin bottom-left, y grows upward.
 */

const MARGIN = 56
const CONTENT_W = PAGE_W - MARGIN * 2
const INK = '#1a1a1a'
const MUTED = '#4a4a4a'
const RULE = '#9a9a9a'

export interface Fonts {
  regular: PDFFont
  bold: PDFFont
  italic: PDFFont
}

export async function loadFonts(): Promise<Fonts> {
  const doc = await PDFDocument.create()
  return {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  }
}

const pick = (f: Fonts, w: Weight) => (w === 'bold' ? f.bold : w === 'italic' ? f.italic : f.regular)

/** pdf-lib's standard fonts are WinAnsi — map the few non-Latin1 glyphs we use. */
export function sanitise(s: string): string {
  return s
    .replace(/’|‘/g, "'")
    .replace(/“|”/g, '"')
    .replace(/–|—/g, '-')
    .replace(/…/g, '...')
    .replace(/²/g, '2')
    .replace(/µ/g, 'u')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/ /g, ' ')
    // U+2022 survives: WinAnsiEncoding maps it, and the bullet lists need it.
    .replace(/[^\x20-\x7E\xA0-\xFF•]/g, '')
}

function width(f: Fonts, w: Weight, size: number, text: string) {
  return pick(f, w).widthOfTextAtSize(sanitise(text), size)
}

function wrap(f: Fonts, w: Weight, size: number, text: string, maxW: number): string[] {
  const words = sanitise(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (width(f, w, size, next) <= maxW || !line) line = next
    else {
      lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/** Cursor-based page builder. Emits a new page whenever the cursor runs out. */
class Sheet {
  pages: LaidOutPage[] = [{ items: [] }]
  y = PAGE_H - MARGIN
  private pageNo = 1

  constructor(private f: Fonts) {}

  private get cur() {
    return this.pages[this.pages.length - 1]
  }

  push(item: LayoutItem) {
    this.cur.items.push(item)
  }

  need(h: number) {
    // Footer rule sits at MARGIN+22, footer text at MARGIN+10 — content may
    // run down to MARGIN+32 without colliding.
    if (this.y - h < MARGIN + 32) this.newPage()
  }

  newPage() {
    this.pages.push({ items: [] })
    this.pageNo++
    this.y = PAGE_H - MARGIN
  }

  /** Honour an author's explicit page break only if the page is >60% consumed. */
  breakIfPageMostlyUsed() {
    const usable = PAGE_H - MARGIN * 2
    const consumed = PAGE_H - MARGIN - this.y
    if (consumed / usable > 0.6) this.newPage()
  }

  gap(h: number) {
    this.y -= h
  }

  text(
    text: string,
    opts: {
      size?: number
      weight?: Weight
      colour?: string
      x?: number
      maxW?: number
      leading?: number
      align?: 'left' | 'right' | 'center'
    } = {}
  ) {
    const size = opts.size ?? 10
    const weight = opts.weight ?? 'regular'
    const x = opts.x ?? MARGIN
    const maxW = opts.maxW ?? CONTENT_W
    const leading = opts.leading ?? size * 1.42
    for (const line of wrap(this.f, weight, size, text, maxW)) {
      this.need(leading)
      this.y -= leading
      this.push({
        k: 'text',
        x,
        y: this.y,
        size,
        weight,
        text: line,
        colour: opts.colour ?? INK,
        align: opts.align,
      })
    }
  }

  /** Single line, no wrapping — for right-aligned letterhead lines. */
  line1(
    text: string,
    opts: { size?: number; weight?: Weight; colour?: string; x?: number; align?: 'left' | 'right' } = {}
  ) {
    const size = opts.size ?? 9
    const leading = size * 1.4
    this.need(leading)
    this.y -= leading
    this.push({
      k: 'text',
      x: opts.x ?? MARGIN,
      y: this.y,
      size,
      weight: opts.weight ?? 'regular',
      text: sanitise(text),
      colour: opts.colour ?? INK,
      align: opts.align,
    })
  }

  rule(colour = RULE, w = 0.7) {
    this.need(8)
    this.y -= 6
    this.push({ k: 'line', x1: MARGIN, y1: this.y, x2: PAGE_W - MARGIN, y2: this.y, width: w, colour })
    this.y -= 4
  }

  measure(text: string, weight: Weight, size: number) {
    return width(this.f, weight, size, text)
  }

  wrapText(text: string, weight: Weight, size: number, maxW: number) {
    return wrap(this.f, weight, size, text, maxW)
  }

  get pageCount() {
    return this.pageNo
  }
}

export function layoutArtefact(a: Artefact, fonts: Fonts): LaidOutPage[] {
  const s = new Sheet(fonts)

  /* ---- letterhead ---- */
  if (a.letterhead) {
    const lh = a.letterhead
    const topY = s.y
    s.line1(lh.org, { size: 13.5, weight: 'bold' })
    if (lh.dept) s.line1(lh.dept, { size: 10.5, colour: MUTED })

    // Address block, right-aligned, drawn at the same vertical band.
    const right = PAGE_W - MARGIN
    let ry = topY - 9
    for (const l of [...(lh.addressLines ?? []), lh.tel ? `Tel ${lh.tel}` : '', lh.email ?? ''].filter(
      Boolean
    )) {
      s.push({ k: 'text', x: right, y: ry, size: 8.2, weight: 'regular', text: sanitise(l), colour: MUTED, align: 'right' })
      ry -= 10
    }
    s.y = Math.min(s.y, ry) - 4
    s.rule('#111111', 1.1)
    s.gap(10)
  }

  /* ---- date / ref ---- */
  if (a.meta) {
    if (a.meta.ourRef) s.line1(`Our ref: ${a.meta.ourRef}`, { size: 8.6, colour: MUTED })
    s.line1(formatUkDate(a.meta.date), { size: 9.5 })
    s.gap(8)
  }

  /* ---- recipient ---- */
  if (a.recipient) {
    s.line1(a.recipient.name, { size: 9.5, weight: 'bold' })
    for (const l of a.recipient.lines ?? []) s.line1(l, { size: 9.5 })
    s.gap(10)
  }

  /* ---- Re: patient block ---- */
  if (a.patient) {
    const p = a.patient
    s.line1(`Re: ${p.name}`, { size: 9.8, weight: 'bold' })
    s.line1(`Date of birth: ${p.dob}    NHS number: ${p.nhsNumber}`, { size: 9, colour: MUTED })
    if (p.addressLines?.length) s.line1(p.addressLines.join(', '), { size: 9, colour: MUTED })
    s.gap(10)
  }

  if (a.salutation) {
    s.line1(a.salutation, { size: 10 })
    s.gap(6)
  }

  /* ---- body ---- */
  for (const b of a.blocks) {
    switch (b.type) {
      case 'heading':
        s.gap(8)
        s.text(b.text, { size: 10.5, weight: 'bold' })
        s.gap(2)
        break

      case 'para':
        s.text(b.text, { size: 10, leading: 14.2 })
        s.gap(7)
        break

      case 'bullets':
        for (const item of b.items) {
          const bulletX = MARGIN + 10
          const textX = MARGIN + 22
          const lines = s.wrapText(item, 'regular', 10, CONTENT_W - 22)
          lines.forEach((line, i) => {
            s.need(14)
            s.y -= 14
            if (i === 0)
              s.push({ k: 'text', x: bulletX, y: s.y, size: 10, weight: 'regular', text: '•', colour: INK })
            s.push({ k: 'text', x: textX, y: s.y, size: 10, weight: 'regular', text: line, colour: INK })
          })
          s.gap(2)
        }
        s.gap(6)
        break

      case 'kv': {
        const labelW = Math.min(
          170,
          Math.max(...b.rows.map((r) => s.measure(r[0], 'bold', 9.5))) + 14
        )
        for (const [k, v] of b.rows) {
          const lines = s.wrapText(v, 'regular', 9.5, CONTENT_W - labelW)
          lines.forEach((line, i) => {
            s.need(13.5)
            s.y -= 13.5
            if (i === 0)
              s.push({ k: 'text', x: MARGIN, y: s.y, size: 9.5, weight: 'bold', text: sanitise(k), colour: INK })
            s.push({ k: 'text', x: MARGIN + labelW, y: s.y, size: 9.5, weight: 'regular', text: line, colour: INK })
          })
        }
        s.gap(8)
        break
      }

      case 'table': {
        // Weight column widths by their widest cell, then normalise to the content width.
        const raw = b.columns.map((c, i) => {
          const cells = [c, ...b.rows.map((r) => r[i] ?? '')]
          return Math.max(...cells.map((t) => s.measure(String(t), 'regular', 9))) + 16
        })
        const total = raw.reduce((x, y) => x + y, 0)
        const widths = raw.map((w) => (w / total) * CONTENT_W)
        const xs: number[] = []
        let acc = MARGIN
        for (const w of widths) {
          xs.push(acc)
          acc += w
        }

        s.need(30)
        s.gap(4)
        // header
        s.y -= 13
        b.columns.forEach((c, i) =>
          s.push({ k: 'text', x: xs[i], y: s.y, size: 9, weight: 'bold', text: sanitise(String(c)), colour: INK })
        )
        s.y -= 4
        s.push({ k: 'line', x1: MARGIN, y1: s.y, x2: PAGE_W - MARGIN, y2: s.y, width: 0.6, colour: '#666666' })

        for (const row of b.rows) {
          const cellLines = row.map((cell, i) => s.wrapText(String(cell ?? ''), 'regular', 9, widths[i] - 12))
          const rowH = Math.max(...cellLines.map((l) => l.length)) * 12
          s.need(rowH + 4)
          const startY = s.y
          cellLines.forEach((lines, i) => {
            lines.forEach((line, j) => {
              s.push({
                k: 'text',
                x: xs[i],
                y: startY - 12 - j * 12,
                size: 9,
                weight: 'regular',
                text: line,
                colour: INK,
              })
            })
          })
          s.y = startY - rowH - 3
          s.push({ k: 'line', x1: MARGIN, y1: s.y, x2: PAGE_W - MARGIN, y2: s.y, width: 0.3, colour: '#cccccc' })
        }
        if (b.caption) {
          s.gap(4)
          s.text(b.caption, { size: 8.4, weight: 'italic', colour: MUTED })
        }
        s.gap(10)
        break
      }

      case 'handwritten': {
        // Biro: oblique, slightly larger, tilted, in blue-black.
        s.gap(6)
        const lines = s.wrapText(b.text, 'italic', 11.5, CONTENT_W - 40)
        lines.forEach((line, i) => {
          s.need(17)
          s.y -= 17
          s.push({
            k: 'text',
            x: MARGIN + 14,
            y: s.y,
            size: 11.5,
            weight: 'italic',
            text: line,
            colour: '#26346b',
            rotate: i % 2 === 0 ? -1.4 : -0.7,
          })
        })
        s.gap(8)
        break
      }

      case 'pagebreak':
        // Soft break. The engine already paginates on overflow, so an author's
        // explicit break is only honoured once the page is genuinely used up —
        // otherwise a 2-page letter renders as four half-empty ones.
        s.breakIfPageMostlyUsed()
        break

      case 'spacer':
        s.gap(12)
        break
    }
  }

  /* ---- signoff ---- */
  if (a.signoff) {
    s.gap(14)
    s.line1(a.signoff.closing, { size: 10 })
    s.gap(20)
    s.line1(a.signoff.name, { size: 10, weight: 'bold' })
    s.line1(a.signoff.title, { size: 9, colour: MUTED })
  }

  if (a.cc?.length) {
    s.gap(10)
    s.line1(`cc: ${a.cc.join('; ')}`, { size: 8.6, colour: MUTED })
  }

  /* ---- footer on every page ---- */
  const footer = a.footer ?? 'FICTIONAL DEMONSTRATION DOCUMENT - NOT A REAL MEDICAL RECORD - DRAFT'
  s.pages.forEach((page, i) => {
    page.items.push({
      k: 'line',
      x1: MARGIN,
      y1: MARGIN + 22,
      x2: PAGE_W - MARGIN,
      y2: MARGIN + 22,
      width: 0.4,
      colour: '#cccccc',
    })
    page.items.push({
      k: 'text',
      x: MARGIN,
      y: MARGIN + 10,
      size: 7,
      weight: 'regular',
      text: sanitise(footer),
      colour: '#8a8a8a',
    })
    page.items.push({
      k: 'text',
      x: PAGE_W - MARGIN,
      y: MARGIN + 10,
      size: 7,
      weight: 'regular',
      text: `Page ${i + 1} of ${s.pages.length}`,
      colour: '#8a8a8a',
      align: 'right',
    })
  })

  return s.pages
}

export function formatUkDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ]
  return `${d} ${months[m - 1]} ${y}`
}

export { MARGIN, CONTENT_W }
