/**
 * The demo artefact spec (demo-data/source/NN.doc.json) plus the deterministic
 * "what a faithful transcript of this looks like" function.
 *
 * Lives in lib/ rather than scripts/ because the seed script needs transcripts
 * for documents it never renders, and the extraction test needs a ground truth
 * to diff Stage A against.
 */

export type Block =
  | { type: 'heading'; text: string }
  | { type: 'para'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'kv'; rows: [string, string][] }
  | { type: 'table'; columns: string[]; rows: string[][]; caption?: string }
  | { type: 'handwritten'; text: string }
  | { type: 'pagebreak' }
  | { type: 'spacer' }

export interface BoxFace {
  brand: string
  drug: string
  strength: string
  form: string
  quantity: string
  directions: string
  patientLine: string
  pharmacyLine: string
  warnings: string[]
}

export type RenderKind = 'pdf' | 'photo_box' | 'photo_letter' | 'photo_slip' | 'voice'

export interface Artefact {
  id: string
  slug: string
  render: RenderKind
  docType: string
  humanTitle: string
  letterhead?: {
    org: string
    dept?: string
    addressLines?: string[]
    tel?: string
    email?: string
  }
  meta?: { date: string; ourRef?: string; nhsNumber?: string }
  recipient?: { name: string; lines?: string[] }
  patient?: { name: string; dob: string; nhsNumber: string; addressLines?: string[] }
  salutation?: string
  blocks: Block[]
  boxFace?: BoxFace
  signoff?: { closing: string; name: string; title: string }
  cc?: string[]
  footer?: string
  durationSeconds?: number
}

/** The file that carries this artefact, relative to demo-data/docs. */
export function artefactFilename(a: Artefact): string {
  const ext = a.render === 'voice' ? 'txt' : a.render === 'pdf' ? 'pdf' : 'jpg'
  return `${a.id}-${a.slug}.${ext}`
}

export function artefactKind(a: Artefact): 'letter_photo' | 'pdf' | 'voice_note' | 'box_photo' {
  if (a.render === 'voice') return 'voice_note'
  if (a.render === 'photo_box') return 'box_photo'
  if (a.render === 'pdf') return 'pdf'
  return 'letter_photo'
}

/**
 * A faithful plain-text transcript — what Stage A should produce from this
 * document. Reading order: letterhead, addresses, body, signoff.
 */
export function artefactTranscript(a: Artefact): string {
  const out: string[] = []
  const push = (s?: string | null) => {
    if (s && String(s).trim()) out.push(String(s).trim())
  }

  if (a.letterhead) {
    push(a.letterhead.org)
    push(a.letterhead.dept)
    for (const l of a.letterhead.addressLines ?? []) push(l)
    if (a.letterhead.tel) push(`Tel ${a.letterhead.tel}`)
    if (a.letterhead.email) push(a.letterhead.email)
    out.push('')
  }

  if (a.meta?.ourRef) push(`Our ref: ${a.meta.ourRef}`)
  if (a.meta?.date) push(formatUkDate(a.meta.date))
  if (a.meta) out.push('')

  if (a.recipient) {
    push(a.recipient.name)
    for (const l of a.recipient.lines ?? []) push(l)
    out.push('')
  }

  if (a.patient) {
    push(`Re: ${a.patient.name}`)
    push(`Date of birth: ${a.patient.dob}    NHS number: ${a.patient.nhsNumber}`)
    if (a.patient.addressLines?.length) push(a.patient.addressLines.join(', '))
    out.push('')
  }

  if (a.salutation) {
    push(a.salutation)
    out.push('')
  }

  for (const b of a.blocks ?? []) {
    switch (b.type) {
      case 'heading':
        out.push('', b.text)
        break
      case 'para':
        out.push(b.text, '')
        break
      case 'bullets':
        for (const i of b.items) out.push(`• ${i}`)
        out.push('')
        break
      case 'kv':
        for (const [k, v] of b.rows) out.push(`${k}: ${v}`)
        out.push('')
        break
      case 'table':
        out.push(b.columns.join('  |  '))
        for (const r of b.rows) out.push(r.map((c) => String(c ?? '')).join('  |  '))
        if (b.caption) out.push(b.caption)
        out.push('')
        break
      case 'handwritten':
        out.push(`[handwritten] ${b.text}`, '')
        break
      case 'pagebreak':
      case 'spacer':
        break
    }
  }

  if (a.boxFace) {
    const f = a.boxFace
    out.push(
      f.drug,
      `${f.strength}  ${f.form}`,
      f.quantity,
      f.directions,
      f.patientLine,
      f.pharmacyLine,
      ...f.warnings
    )
  }

  if (a.signoff) {
    out.push('', a.signoff.closing, '', a.signoff.name, a.signoff.title)
  }
  if (a.cc?.length) out.push(`cc: ${a.cc.join('; ')}`)
  if (a.footer) out.push('', a.footer)

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
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
