import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { sanitise } from './render/layout'
import type { Artefact, Block } from './render/types'

/**
 * Static guard on the demo dataset. Runs offline, costs nothing, and catches
 * the class of defect that would otherwise fail `test:extraction` forever:
 * a fixture asserting a string the artefact never actually says.
 */

const SRC = path.join(process.cwd(), 'demo-data', 'source')
const FIX = path.join(process.cwd(), 'demo-data', 'fixtures')

const OK_BLOCK = new Set(['heading', 'para', 'bullets', 'kv', 'table', 'handwritten', 'pagebreak', 'spacer'])
const OK_RENDER = new Set(['pdf', 'photo_box', 'photo_letter', 'photo_slip', 'voice'])
const OK_LOOP = new Set(['referral', 'test', 'letter', 'follow_up', 'other'])
const ISO = /^\d{4}-\d{2}-\d{2}$/

/** Everything a faithful transcript of this artefact would contain. */
function renderedText(a: Artefact): string {
  const out: string[] = [
    a.letterhead?.org ?? '',
    a.letterhead?.dept ?? '',
    ...(a.letterhead?.addressLines ?? []),
    a.letterhead?.tel ?? '',
    a.recipient?.name ?? '',
    ...(a.recipient?.lines ?? []),
    a.patient?.name ?? '',
    a.patient?.dob ?? '',
    a.patient?.nhsNumber ?? '',
    ...(a.patient?.addressLines ?? []),
    a.salutation ?? '',
    a.signoff ? `${a.signoff.closing} ${a.signoff.name} ${a.signoff.title}` : '',
    ...(a.cc ?? []),
  ]
  for (const b of a.blocks as Block[]) {
    if (b.type === 'heading' || b.type === 'para' || b.type === 'handwritten') out.push(b.text)
    else if (b.type === 'bullets') out.push(...b.items)
    else if (b.type === 'kv') out.push(...b.rows.flat())
    else if (b.type === 'table') {
      out.push(...b.columns, ...b.rows.flat().map(String))
      if (b.caption) out.push(b.caption)
    }
  }
  if (a.boxFace) {
    const f = a.boxFace
    out.push(f.brand, f.drug, f.strength, f.form, f.quantity, f.directions, f.patientLine, f.pharmacyLine, ...f.warnings)
  }
  return norm(out.join(' \n '))
}

const norm = (s: string) => sanitise(String(s)).replace(/\s+/g, ' ').trim().toLowerCase()

async function main() {
  const problems: string[] = []
  const p = (s: string) => problems.push(s)

  const srcFiles = (await readdir(SRC)).filter((f) => f.endsWith('.doc.json')).sort()
  const fixFiles = (await readdir(FIX)).filter((f) => f.endsWith('.json')).sort()

  const ids = srcFiles.map((f) => f.replace('.doc.json', ''))
  for (const id of ids) {
    if (!fixFiles.includes(`${id}.json`)) p(`${id}: artefact has no fixture`)
  }

  let lowCount = 0
  let factCount = 0
  const lowDocs = new Set<string>()

  for (const file of srcFiles) {
    const id = file.replace('.doc.json', '')
    let a: Artefact
    try {
      a = JSON.parse(await readFile(path.join(SRC, file), 'utf8'))
    } catch (e) {
      p(`${file}: invalid JSON — ${(e as Error).message}`)
      continue
    }

    if (a.id !== id) p(`${file}: id "${a.id}" does not match filename`)
    if (!OK_RENDER.has(a.render)) p(`${file}: unknown render "${a.render}"`)
    if (!a.humanTitle) p(`${file}: missing humanTitle`)
    for (const b of a.blocks ?? []) {
      if (!OK_BLOCK.has(b.type)) p(`${file}: unknown block type "${(b as { type: string }).type}"`)
    }
    if (a.render === 'photo_box' && !a.boxFace) p(`${file}: photo_box without boxFace`)

    // ---- fixture
    let fx: Record<string, unknown>
    try {
      fx = JSON.parse(await readFile(path.join(FIX, `${id}.json`), 'utf8'))
    } catch (e) {
      p(`${id}.json: invalid JSON — ${(e as Error).message}`)
      continue
    }

    const meta = fx.doc_meta as { type?: string; date?: string; sender?: string; human_title?: string } | undefined
    if (!meta) p(`${id}.json: missing doc_meta`)
    else {
      if (!meta.date || !ISO.test(meta.date)) p(`${id}.json: doc_meta.date "${meta.date}" is not ISO`)
      if (meta.date && a.meta?.date && meta.date !== a.meta.date)
        p(`${id}.json: doc_meta.date ${meta.date} != artefact date ${a.meta.date}`)
      if (!meta.human_title) p(`${id}.json: doc_meta.human_title missing`)
    }

    // The guard that matters: every asserted string must really be in the text.
    const text = renderedText(a)
    const isDuplicateFixture = typeof fx.duplicate_of === 'string'
    const musts = (fx.transcript_must_include as string[]) ?? []
    // A duplicate fixture only evidences the page that was photographed, so it
    // legitimately asserts fewer strings and carries no fact sections.
    if (!isDuplicateFixture && musts.length < 3)
      p(`${id}.json: transcript_must_include has only ${musts.length} entries`)
    if (musts.length === 0) p(`${id}.json: transcript_must_include is empty`)
    for (const m of musts) {
      if (!text.includes(norm(m))) p(`${id}.json: transcript_must_include "${m}" is NOT in the artefact text`)
    }

    for (const [section, rows] of Object.entries(fx)) {
      if (!Array.isArray(rows) || section === 'transcript_must_include') continue
      if (rows.length === 0) p(`${id}.json: empty section "${section}" should be omitted`)
      for (const row of rows as Record<string, unknown>[]) {
        factCount++
        const conf = row.expected_confidence
        if (conf !== 'high' && conf !== 'low') p(`${id}.json/${section}: expected_confidence "${conf}"`)
        if (conf === 'low') {
          lowCount++
          lowDocs.add(id)
        }
        if (section === 'open_loops') {
          if (!OK_LOOP.has(String(row.type))) p(`${id}.json/open_loops: bad type "${row.type}"`)
          const d = row.expected_date
          if (d !== null && d !== undefined && !ISO.test(String(d)))
            p(`${id}.json/open_loops: expected_date "${d}" is not ISO or null`)
        }
        if (section === 'results') {
          if (row.value !== undefined && row.value_text !== undefined)
            p(`${id}.json/results "${row.name}": has both value and value_text`)
          if (row.value === undefined && row.value_text === undefined)
            p(`${id}.json/results "${row.name}": has neither value nor value_text`)
        }
      }
    }
  }

  // Bible §10: amber facts exist only where the artefact is genuinely ambiguous
  // — the blurred box (12) and the handwritten slip (S2). Membership matters
  // more than the exact count, which shifts as those two documents are curated.
  const ALLOWED_AMBER_DOCS = new Set(['12', 'S2'])
  if (lowCount === 0) p('dataset: no low-confidence facts — the amber path is untested')
  for (const d of lowDocs) {
    if (!ALLOWED_AMBER_DOCS.has(d))
      p(`dataset: document ${d} carries a low-confidence fact but is not an amber case (bible §10)`)
  }

  console.log(`Checked ${srcFiles.length} artefacts / ${fixFiles.length} fixtures · ${factCount} facts · ${lowCount} amber`)
  if (problems.length) {
    console.log(`\nDATASET: ${problems.length} PROBLEM(S)`)
    for (const x of problems) console.log(`  - ${x}`)
    process.exit(1)
  }
  console.log('DATASET: OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
