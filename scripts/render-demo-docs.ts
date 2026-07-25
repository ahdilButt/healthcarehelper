import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { layoutArtefact, loadFonts, sanitise } from './render/layout'
import { boxFaceSvg, pageToSvg, svgToPhoto, toPdf } from './render/backends'
import type { Artefact } from './render/types'

const ROOT = process.cwd()
const SRC = path.join(ROOT, 'demo-data', 'source')
const OUT = path.join(ROOT, 'demo-data', 'docs')
const FIX = path.join(ROOT, 'demo-data', 'fixtures')

/**
 * Renders every artefact spec in demo-data/source into a real file the ingest
 * pipeline can eat: PDFs for correspondence, JPEGs for the photographed cases,
 * a transcript for the voice note.
 */
async function main() {
  await mkdir(OUT, { recursive: true })
  const fonts = await loadFonts()
  // 12b is derived from 08 at the end of this script — never rendered from source.
  const files = (await readdir(SRC))
    .filter((f) => f.endsWith('.doc.json') && f !== '12b.doc.json')
    .sort()
  const built: string[] = []

  for (const file of files) {
    const a: Artefact = JSON.parse(await readFile(path.join(SRC, file), 'utf8'))
    const base = `${a.id}-${a.slug}`

    if (a.render === 'voice') {
      const script = a.blocks
        .filter((b): b is { type: 'para'; text: string } => b.type === 'para')
        .map((b) => b.text)
        .join('\n\n')
      const body =
        `# Voice note - ${a.humanTitle}\n` +
        `# Recorded ${a.meta?.date ?? ''} by Ms Amira Adeyemi (~${a.durationSeconds ?? 30}s)\n` +
        `# ${a.footer ?? 'FICTIONAL DEMONSTRATION DOCUMENT - NOT A REAL MEDICAL RECORD - DRAFT'}\n\n${script}\n`
      await writeFile(path.join(OUT, `${base}.txt`), body, 'utf8')
      built.push(`${base}.txt`)
      continue
    }

    if (a.render === 'photo_box') {
      if (!a.boxFace) throw new Error(`${file}: render=photo_box but no boxFace`)
      // The dataset's headline amber case: a genuine bad-light, out-of-focus
      // phone snap. The strength has to be readable-but-doubtful, or the
      // "unconfirmed" path never fires.
      // Calibration matters here. At blur 5.4/900px the strength was still
      // crisp enough to read confidently, so the pipeline scored it 0.96 and
      // the "unconfirmed" path never fired — correctly, because nothing was
      // actually ambiguous. The artefact has to be genuinely marginal.
      const jpg = await svgToPhoto(boxFaceSvg(a.boxFace, a.footer), {
        rotate: -8.5,
        blur: 8.5,
        shadow: 0.62,
        quality: 46,
        longEdge: 620,
      })
      await writeFile(path.join(OUT, `${base}.jpg`), jpg)
      built.push(`${base}.jpg`)
      continue
    }

    const pages = layoutArtefact(a, fonts)

    if (a.render === 'photo_slip') {
      const jpg = await svgToPhoto(pageToSvg(pages[0]), {
        rotate: 2.4,
        blur: 0.6,
        shadow: 0.3,
        quality: 84,
        longEdge: 1700,
      })
      await writeFile(path.join(OUT, `${base}.jpg`), jpg)
      built.push(`${base}.jpg`)
      continue
    }

    const pdf = await toPdf(pages)
    await writeFile(path.join(OUT, `${base}.pdf`), pdf)
    built.push(`${base}.pdf`)
  }

  // ---- 12b: the duplicate. Literally document 08, photographed at an angle
  // in different light. Derived, never hand-authored, so it can never drift.
  const eight: Artefact = JSON.parse(await readFile(path.join(SRC, '08.doc.json'), 'utf8'))
  const pages08 = layoutArtefact(eight, fonts)
  const dupJpg = await svgToPhoto(pageToSvg(pages08[0]), {
    rotate: -3.8,
    blur: 1.1,
    shadow: 0.52,
    quality: 78,
    longEdge: 1500,
  })
  const dupBase = '12b-cardiology-letter-12-may-photo'
  await writeFile(path.join(OUT, `${dupBase}.jpg`), dupJpg)
  built.push(`${dupBase}.jpg`)

  await writeFile(
    path.join(SRC, '12b.doc.json'),
    JSON.stringify(
      { ...eight, id: '12b', slug: 'cardiology-letter-12-may-photo', render: 'photo_letter' },
      null,
      2
    ),
    'utf8'
  )

  // The 12b fixture must assert ONLY what is visible in the photograph, which
  // is page 1 of a 3-page letter. Copying 08's fixture wholesale asserts
  // page-2/3 strings that can never be transcribed, which would fail
  // test:extraction forever. 12b proves duplicate detection, not extraction,
  // so it carries no fact sections at all.
  const fix08 = JSON.parse(await readFile(path.join(FIX, '08.json'), 'utf8'))
  const page1Text = pages08[0].items
    .filter((i): i is Extract<typeof i, { k: 'text' }> => i.k === 'text')
    .map((i) => i.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
  const visible = (fix08.transcript_must_include as string[]).filter((m) =>
    page1Text.includes(m.replace(/\s+/g, ' ').trim().toLowerCase())
  )

  await writeFile(
    path.join(FIX, '12b.json'),
    JSON.stringify(
      {
        doc_meta: fix08.doc_meta,
        transcript_must_include: visible,
        duplicate_of: '08',
        note: 'Page 1 of document 08, photographed at an angle in different light. Tests duplicate detection, not extraction — hence no fact sections.',
      },
      null,
      2
    ),
    'utf8'
  )

  console.log(`Rendered ${built.length} artefacts into demo-data/docs:`)
  for (const b of built.sort()) console.log(`  ${b}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

export { sanitise }
