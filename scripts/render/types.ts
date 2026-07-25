/** Layout primitives for the renderer. The artefact spec itself lives in lib/demo. */

export type { Artefact, Block, BoxFace, RenderKind } from '@/lib/demo/artefact'

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
