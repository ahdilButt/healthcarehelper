import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { layoutArtefact, loadFonts, sanitise } from './scripts/render/layout'
import { boxFaceSvg } from './scripts/render/backends'
import type { Artefact } from './scripts/render/types'

const ROOT = 'C:/Users/acada/Desktop/misc_projects/juno_hackathon/prototype-2'
const SRC = path.join(ROOT, 'demo-data', 'source')
const FIX = path.join(ROOT, 'demo-data', 'fixtures')

const norm = (s: string) => sanitise(s).replace(/\s+/g, ' ').trim()

const OK_BLOCK = new Set(['heading', 'para', 'bullets', 'kv', 'table', 'handwritten', 'pagebreak', 'spacer'])
const OK_RENDER = new Set(['pdf', 'photo_box', 'photo_letter', 'photo_slip', 'voice'])
const OK_LOOP = new Set(['referral', 'test', 'letter', 'follow_up', 'other'])
const ISO = /^\d{4}-\d{2}-\d{2}$/

const problems: string[] = []
const p = (s: string) => problems.push(s)

async function main() {
  const fonts = await loadFonts()
  const srcFiles = (await readdir(SRC)).filter((f) => f.endsWith('.doc.json')).sort()
  const fixFiles = (await readdir(FIX)).filter((f) => f.endsWith('.json')).sort()

  const expectedIds = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '12b', 'S1', 'S2']
  for (const id of expectedIds) {
    if (!srcFiles.includes(`${id}.doc.json`)) p(`MISSING source/${id}.doc.json`)
    if (!fixFiles.includes(`${id}.json`)) p(`MISSING fixtures/${id}.json`)
  }
  for (const f of srcFiles) {
    const id = f.replace('.doc.json', '')
    if (!expectedIds.includes(id)) p(`UNEXPECTED source file ${f}`)
  }
  for (const f of fixFiles) {
    const id = f.replace('.json', '')
    if (!expectedIds.includes(id)) p(`UNEXPECTED fixture file ${f}`)
  }

  const lowCount: Record<string, string[]> = {}

  for (const f of srcFiles) {
    const id = f.replace('.doc.json', '')
    const a: Artefact = JSON.parse(await readFile(path.join(SRC, f), 'utf8'))

    if (a.id !== id) p(`source/${f}: id "${a.id}" != filename id "${id}"`)
    if (!OK_RENDER.has(a.render)) p(`source/${f}: bad render "${a.render}"`)
    if (!a.docType || typeof a.docType !== 'string') p(`source/${f}: missing docType`)
    if (!a.humanTitle || !a.humanTitle.trim()) p(`source/${f}: empty humanTitle`)
    if (!Array.isArray(a.blocks)) p(`source/${f}: blocks is not an array`)
    else {
      a.blocks.forEach((b: any, i: number) => {
        if (!OK_BLOCK.has(b?.type)) p(`source/${f}: blocks[${i}] unrecognised type "${b?.type}"`)
      })
      if (a.blocks.length === 0) p(`NOTE source/${f}: blocks[] is empty`)
    }
    if (!a.meta?.date || !ISO.test(a.meta.date)) p(`source/${f}: meta.date not ISO ("${a.meta?.date}")`)

    // --- rendered text ---
    let pagesText: string[] = []
    if (a.render === 'voice') {
      pagesText = [
        norm(
          `# Voice note - ${a.humanTitle}\n# Recorded ${a.meta?.date ?? ''} by Ms Amira Adeyemi (~${a.durationSeconds ?? 30}s)\n# FICTIONAL DEMONSTRATION ARTEFACT - DRAFT\n\n` +
            a.blocks
              .filter((b: any) => b.type === 'para')
              .map((b: any) => b.text)
              .join('\n\n')
        ),
      ]
    } else if (a.render === 'photo_box') {
      const svg = boxFaceSvg(a.boxFace!)
      pagesText = [norm(svg.replace(/<[^>]+>/g, ' '))]
    } else {
      const pages = layoutArtefact(a, fonts)
      pagesText = pages.map((pg) =>
        norm(pg.items.filter((it: any) => it.k === 'text').map((it: any) => it.text).join(' '))
      )
      if (a.render === 'photo_slip') pagesText = [pagesText[0]] // only page 1 is photographed
    }

    // 12b is rendered from 08 page 1 only
    if (id === '12b') {
      const eight: Artefact = JSON.parse(await readFile(path.join(SRC, '08.doc.json'), 'utf8'))
      const pg = layoutArtefact(eight, fonts)
      pagesText = [
        norm(pg[0].items.filter((it: any) => it.k === 'text').map((it: any) => it.text).join(' ')),
      ]
    }

    const all = pagesText.join(' \u0000 ')

    // --- fixture ---
    let fx: any
    try {
      fx = JSON.parse(await readFile(path.join(FIX, `${id}.json`), 'utf8'))
    } catch {
      p(`fixtures/${id}.json unreadable`)
      continue
    }

    const dm = fx.doc_meta
    if (!dm) p(`fixtures/${id}.json: no doc_meta`)
    else {
      for (const k of ['type', 'date', 'sender', 'human_title']) {
        if (!dm[k]) p(`fixtures/${id}.json: doc_meta.${k} missing`)
      }
      if (dm.date && !ISO.test(dm.date)) p(`fixtures/${id}.json: doc_meta.date "${dm.date}" not ISO`)
      if (dm.date && a.meta?.date && dm.date !== a.meta.date)
        p(`fixtures/${id}.json: doc_meta.date ${dm.date} != source meta.date ${a.meta.date}`)
      if (dm.type !== a.docType) p(`fixtures/${id}.json: doc_meta.type "${dm.type}" != source docType "${a.docType}"`)
      if (dm.human_title !== a.humanTitle)
        p(`fixtures/${id}.json: human_title "${dm.human_title}" != source humanTitle "${a.humanTitle}"`)
    }

    const tmi = fx.transcript_must_include
    if (!Array.isArray(tmi)) p(`fixtures/${id}.json: transcript_must_include missing/not array`)
    else {
      if (tmi.length < 4 || tmi.length > 8)
        p(`fixtures/${id}.json: transcript_must_include has ${tmi.length} entries (need 4-8)`)
      tmi.forEach((s: any, i: number) => {
        if (typeof s !== 'string' || !s.trim()) {
          p(`fixtures/${id}.json: transcript_must_include[${i}] not a non-empty string`)
          return
        }
        const needle = norm(s)
        const hitSame = pagesText.some((t) => t.includes(needle))
        if (!hitSame) {
          const hitAcross = all.replace(/\u0000/g, '').replace(/\s+/g, ' ').includes(needle)
          p(
            `TMI MISS fixtures/${id}.json[${i}] "${s}"${hitAcross ? '  (only found spanning a page break)' : ''}`
          )
        }
      })
    }

    // sections
    for (const [sec, arr] of Object.entries(fx)) {
      if (['doc_meta', 'transcript_must_include', 'duplicate_of', 'note'].includes(sec)) continue
      if (!Array.isArray(arr)) {
        p(`fixtures/${id}.json: section "${sec}" is not an array`)
        continue
      }
      if ((arr as any[]).length === 0) p(`fixtures/${id}.json: section "${sec}" is an EMPTY array`)
      ;(arr as any[]).forEach((e: any, i: number) => {
        const c = e.expected_confidence
        if (c !== 'high' && c !== 'low')
          p(`fixtures/${id}.json: ${sec}[${i}] expected_confidence "${c}" (must be high|low)`)
        if (c === 'low') (lowCount[id] ??= []).push(`${sec}[${i}] ${e.name ?? e.substance ?? e.description ?? e.title}`)
      })
      if (sec === 'results') {
        ;(arr as any[]).forEach((r: any, i: number) => {
          const hasV = Object.prototype.hasOwnProperty.call(r, 'value') && r.value !== null
          const hasT = Object.prototype.hasOwnProperty.call(r, 'value_text') && r.value_text !== null
          if (hasV && hasT) p(`fixtures/${id}.json: results[${i}] "${r.name}" has BOTH value and value_text`)
          if (!hasV && !hasT) p(`fixtures/${id}.json: results[${i}] "${r.name}" has NEITHER value nor value_text`)
          if (!Object.prototype.hasOwnProperty.call(r, 'ref_low'))
            p(`fixtures/${id}.json: results[${i}] "${r.name}" missing ref_low`)
          if (!Object.prototype.hasOwnProperty.call(r, 'ref_high'))
            p(`fixtures/${id}.json: results[${i}] "${r.name}" missing ref_high`)
          if (!r.date || !ISO.test(r.date)) p(`fixtures/${id}.json: results[${i}] "${r.name}" date "${r.date}" not ISO`)
        })
      }
      if (sec === 'open_loops') {
        ;(arr as any[]).forEach((l: any, i: number) => {
          if (!OK_LOOP.has(l.type)) p(`fixtures/${id}.json: open_loops[${i}] type "${l.type}" invalid`)
          if (l.expected_date !== null && !ISO.test(l.expected_date ?? ''))
            p(`fixtures/${id}.json: open_loops[${i}] expected_date "${l.expected_date}" not ISO/null`)
        })
      }
    }
  }

  console.log('===== LOW CONFIDENCE FACTS =====')
  let n = 0
  for (const [id, list] of Object.entries(lowCount)) {
    for (const l of list) {
      console.log(`  ${id}: ${l}`)
      n++
    }
  }
  console.log(`  total = ${n}`)
  console.log('\n===== PROBLEMS =====')
  if (!problems.length) console.log('  none')
  for (const x of problems) console.log('  ' + x)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
