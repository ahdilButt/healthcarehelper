import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import sharp from 'sharp'
import { PAGE_H, PAGE_W, type BoxFace, type LaidOutPage, type LayoutItem } from './types'
import { sanitise, type Fonts } from './layout'

/* ------------------------------------------------------------------ PDF */

function hex(c: string) {
  const n = parseInt(c.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

export async function toPdf(pages: LaidOutPage[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const f = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  }
  for (const p of pages) {
    const page = doc.addPage([PAGE_W, PAGE_H])
    for (const it of p.items) {
      if (it.k === 'text') {
        const font = it.weight === 'bold' ? f.bold : it.weight === 'italic' ? f.italic : f.regular
        const text = sanitise(it.text)
        let x = it.x
        if (it.align === 'right') x = it.x - font.widthOfTextAtSize(text, it.size)
        else if (it.align === 'center') x = it.x - font.widthOfTextAtSize(text, it.size) / 2
        page.drawText(text, {
          x,
          y: it.y,
          size: it.size,
          font,
          color: hex(it.colour ?? '#1a1a1a'),
          rotate: it.rotate ? degrees(it.rotate) : undefined,
        })
      } else if (it.k === 'line') {
        page.drawLine({
          start: { x: it.x1, y: it.y1 },
          end: { x: it.x2, y: it.y2 },
          thickness: it.width,
          color: hex(it.colour ?? '#000000'),
        })
      } else {
        page.drawRectangle({ x: it.x, y: it.y, width: it.w, height: it.h, color: hex(it.fill) })
      }
    }
  }
  return doc.save()
}

/* ------------------------------------------------------------------ SVG */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Same layout, rendered as SVG so the "photo" of a letter is the same letter. */
export function pageToSvg(page: LaidOutPage, scale = 2): string {
  const W = PAGE_W * scale
  const H = PAGE_H * scale
  const parts: string[] = []
  for (const it of page.items as LayoutItem[]) {
    if (it.k === 'text') {
      const anchor = it.align === 'right' ? 'end' : it.align === 'center' ? 'middle' : 'start'
      const x = it.x * scale
      const y = (PAGE_H - it.y) * scale
      const weight = it.weight === 'bold' ? '700' : '400'
      const style = it.weight === 'italic' ? 'italic' : 'normal'
      const rot = it.rotate ? ` transform="rotate(${-it.rotate} ${x} ${y})"` : ''
      parts.push(
        `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="Helvetica, Arial, sans-serif" font-size="${(it.size * scale).toFixed(2)}" font-weight="${weight}" font-style="${style}" fill="${it.colour ?? '#1a1a1a'}" text-anchor="${anchor}"${rot}>${esc(sanitise(it.text))}</text>`
      )
    } else if (it.k === 'line') {
      parts.push(
        `<line x1="${(it.x1 * scale).toFixed(2)}" y1="${((PAGE_H - it.y1) * scale).toFixed(2)}" x2="${(it.x2 * scale).toFixed(2)}" y2="${((PAGE_H - it.y2) * scale).toFixed(2)}" stroke="${it.colour ?? '#000'}" stroke-width="${(it.width * scale).toFixed(2)}"/>`
      )
    } else {
      parts.push(
        `<rect x="${(it.x * scale).toFixed(2)}" y="${((PAGE_H - it.y - it.h) * scale).toFixed(2)}" width="${(it.w * scale).toFixed(2)}" height="${(it.h * scale).toFixed(2)}" fill="${it.fill}"/>`
      )
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fdfdfb"/>${parts.join('')}</svg>`
}

export interface PhotoOpts {
  /** degrees of tilt, as if held slightly askew */
  rotate?: number
  /** gaussian sigma; > 0 makes the shot soft */
  blur?: number
  /** 0..1 strength of the diagonal shadow gradient */
  shadow?: number
  /** jpeg quality — lower reads as a phone snap */
  quality?: number
  /** final long-edge pixels */
  longEdge?: number
}

/**
 * Turn an SVG page into something that looks photographed rather than exported:
 * warm paper, a diagonal light falloff, a tilt, and (optionally) soft focus.
 */
export async function svgToPhoto(svg: string, opts: PhotoOpts = {}): Promise<Buffer> {
  const { rotate = 0, blur = 0, shadow = 0.35, quality = 82, longEdge = 1600 } = opts

  let img = sharp(Buffer.from(svg), { density: 144 })
  const meta = await img.metadata()
  const w = meta.width ?? 1200
  const h = meta.height ?? 1700

  // Diagonal light falloff — the giveaway that a page was photographed, not scanned.
  const shade = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
       <defs>
         <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
           <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
           <stop offset="62%" stop-color="#000000" stop-opacity="${(shadow * 0.28).toFixed(3)}"/>
           <stop offset="100%" stop-color="#000000" stop-opacity="${shadow.toFixed(3)}"/>
         </linearGradient>
       </defs>
       <rect width="${w}" height="${h}" fill="url(#g)"/>
     </svg>`
  )

  img = img.composite([{ input: shade, blend: 'multiply' }])

  // Warm the paper a touch, then tilt on a dim surround.
  img = img.modulate({ brightness: 1.02, saturation: 0.92 }).tint({ r: 255, g: 252, b: 244 })

  if (rotate !== 0) {
    img = sharp(await img.png().toBuffer()).rotate(rotate, {
      background: { r: 34, g: 32, b: 30, alpha: 1 },
    })
  }
  if (blur > 0) img = img.blur(blur)

  const resized = sharp(await img.png().toBuffer()).resize({
    width: longEdge,
    height: longEdge,
    fit: 'inside',
    withoutEnlargement: false,
  })

  return resized.jpeg({ quality, mozjpeg: true }).toBuffer()
}

/* ------------------------------------------------- medicine box front face */

export function boxFaceSvg(
  b: BoxFace,
  footer = 'FICTIONAL DEMONSTRATION DOCUMENT - NOT A REAL MEDICAL RECORD - DRAFT'
): string {
  const W = 1000
  const H = 620
  const t = (
    x: number,
    y: number,
    text: string,
    size: number,
    weight = '400',
    fill = '#14213d',
    anchor = 'start'
  ) =>
    `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(text)}</text>`

  const warn = b.warnings
    .slice(0, 3)
    .map((w, i) => t(60, 512 + i * 26, w, 17, '400', '#3a3a3a'))
    .join('')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <rect width="${W}" height="${H}" fill="#f7f5ef"/>
    <rect x="0" y="0" width="${W}" height="14" fill="#0b6b5b"/>
    <rect x="0" y="${H - 14}" width="${W}" height="14" fill="#0b6b5b"/>
    <rect x="40" y="46" width="${W - 80}" height="150" fill="#ffffff" stroke="#d5d0c4" stroke-width="2"/>
    ${t(60, 104, b.drug, 54, '700', '#0b3b57')}
    ${t(60, 156, `${b.strength}  ${b.form}`, 30, '400', '#0b3b57')}
    ${t(W - 60, 104, b.quantity, 28, '700', '#0b6b5b', 'end')}
    <rect x="40" y="216" width="${W - 80}" height="112" fill="#ffffff" stroke="#d5d0c4" stroke-width="2"/>
    ${t(60, 262, b.directions, 32, '700', '#14213d')}
    ${t(60, 302, b.patientLine, 24, '400', '#3a3a3a')}
    <line x1="40" y1="356" x2="${W - 40}" y2="356" stroke="#c9c4b6" stroke-width="2"/>
    ${t(60, 392, b.pharmacyLine, 19, '400', '#3a3a3a')}
    ${t(60, 440, 'Keep this medicine out of the sight and reach of children.', 17, '400', '#3a3a3a')}
    ${t(60, 478, 'WARNINGS', 18, '700', '#8a1f1f')}
    ${warn}
    <g opacity="0.85">
      ${Array.from({ length: 34 })
        .map((_, i) => `<rect x="${640 + i * 8}" y="${H - 130}" width="${i % 3 === 0 ? 4 : 2}" height="72" fill="#111"/>`)
        .join('')}
      ${t(820, H - 40, '5 099471 338207', 18, '400', '#111', 'middle')}
    </g>
    ${t(60, H - 44, footer, 14, '400', '#9a9a9a')}
  </svg>`
}
