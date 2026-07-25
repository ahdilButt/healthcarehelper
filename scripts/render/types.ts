/** The artefact content spec written by the dataset authors (demo-data/source/NN.doc.json). */

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

/* ---------- layout primitives shared by both backends ---------- */

export type Weight = 'regular' | 'bold' | 'italic'

export type LayoutItem =
  | {
      k: 'text'
      x: number
      y: number
      size: number
      weight: Weight
      text: string
      colour?: string
      align?: 'left' | 'right' | 'center'
      rotate?: number
    }
  | { k: 'line'; x1: number; y1: number; x2: number; y2: number; width: number; colour?: string }
  | { k: 'rect'; x: number; y: number; w: number; h: number; fill: string }

export interface LaidOutPage {
  items: LayoutItem[]
}

export const PAGE_W = 595.28
export const PAGE_H = 841.89
