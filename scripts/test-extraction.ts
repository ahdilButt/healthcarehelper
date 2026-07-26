import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
// This gate costs real money and is the developer's spend, not the public
// demo's. Left metered, one run of it would eat the visitors' whole budget.
process.env.USAGE_METER_OFF = 'true'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { transcribe, type Legibility } from '../lib/ingest/stage-a'
import { extractFacts } from '../lib/ingest/stage-b'
import { compareDocument, type DocComparison } from '../lib/demo/compare'
import { artefactFilename, type Artefact } from '../lib/demo/artefact'
import type { Fixture } from '../lib/demo/fixture'

/**
 * `npm run test:extraction` — the hard gate from CLAUDE.md.
 *
 * Runs the real two-stage pipeline over the real artefacts and diffs the
 * result against demo-data/fixtures. No stubs: if this passes, ingest works.
 *
 *   --only=08,12   just those documents
 *   --fresh        ignore the Stage A transcript cache (re-runs vision)
 *   --stage-a      transcribe only, skip extraction
 *
 * Stage A output is cached under demo-data/.transcripts so iterating on the
 * extraction prompt does not re-pay for vision on every run.
 */

const SRC = path.join(process.cwd(), 'demo-data', 'source')
const FIX = path.join(process.cwd(), 'demo-data', 'fixtures')
const DOCS = path.join(process.cwd(), 'demo-data', 'docs')
const CACHE = path.join(process.cwd(), 'demo-data', '.transcripts')

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1]
const flag = (name: string) => process.argv.includes(`--${name}`)

async function main() {
  const only = arg('only')?.split(',').map((s) => s.trim())
  const fresh = flag('fresh')
  const stageAOnly = flag('stage-a')

  await mkdir(CACHE, { recursive: true })

  const specs: Artefact[] = []
  for (const f of (await readdir(SRC)).filter((f) => f.endsWith('.doc.json'))) {
    specs.push(JSON.parse(await readFile(path.join(SRC, f), 'utf8')))
  }
  specs.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }))

  const targets = specs.filter((a) => (only ? only.includes(a.id) : true))
  const results: DocComparison[] = []

  console.log(`Running the extraction pipeline over ${targets.length} artefacts...\n`)

  for (const a of targets) {
    const fixture: Fixture = JSON.parse(await readFile(path.join(FIX, `${a.id}.json`), 'utf8'))
    const file = artefactFilename(a)
    const bytes = await readFile(path.join(DOCS, file))

    // ---- Stage A (cached with its legibility verdict, which Stage B needs)
    const cacheFile = path.join(CACHE, `${a.id}.json`)
    let cached: { transcript: string; legibility: Legibility } | null = null
    if (!fresh) {
      cached = await readFile(cacheFile, 'utf8')
        .then((s) => JSON.parse(s) as { transcript: string; legibility: Legibility })
        .catch(() => null)
    }
    if (cached === null) {
      const stageA = await transcribe(new Uint8Array(bytes), file)
      if (!stageA.readable) {
        console.log(`  ${a.id.padEnd(4)} FAIL  Stage A could not read the document`)
        results.push({
          id: a.id,
          transcriptMisses: fixture.transcript_must_include ?? [],
          mismatches: [{ section: 'stage_a', expected: 'a readable transcript', found: 'UNREADABLE' }],
          extras: [],
          checked: 1,
          passed: false,
        })
        continue
      }
      cached = { transcript: stageA.transcript, legibility: stageA.legibility }
      await writeFile(cacheFile, JSON.stringify(cached, null, 2), 'utf8')
    }
    const { transcript, legibility } = cached

    if (stageAOnly) {
      const misses = (fixture.transcript_must_include ?? []).filter(
        (m) => !transcript.toLowerCase().replace(/\s+/g, ' ').includes(m.toLowerCase().replace(/\s+/g, ' ').trim())
      )
      console.log(
        `  ${a.id.padEnd(4)} ${misses.length ? 'FAIL' : 'ok  '}  transcript ${transcript.length} chars` +
          (misses.length ? `\n         missing: ${misses.join(' | ')}` : '')
      )
      results.push({ id: a.id, transcriptMisses: misses, mismatches: [], extras: [], checked: misses.length, passed: !misses.length })
      continue
    }

    // ---- Stage B
    const facts = await extractFacts(transcript, legibility)
    const cmp = compareDocument(a.id, fixture, transcript, facts)
    results.push(cmp)

    const status = cmp.passed ? 'PASS' : 'FAIL'
    console.log(`  ${a.id.padEnd(4)} ${status}  ${cmp.checked} checks  [${legibility}]  ${a.humanTitle}`)
    for (const m of cmp.transcriptMisses) console.log(`         transcript missing: "${m}"`)
    for (const m of cmp.mismatches) console.log(`         ${m.section}: expected ${m.expected} -> ${m.found}`)
    for (const e of cmp.extras) console.log(`         note  ${e}`)
  }

  const failed = results.filter((r) => !r.passed)
  const checks = results.reduce((n, r) => n + r.checked, 0)
  console.log(
    `\n${results.length - failed.length}/${results.length} documents passed · ${checks} individual checks`
  )
  if (failed.length) {
    console.log(`EXTRACTION: FAIL (${failed.map((f) => f.id).join(', ')})`)
    process.exit(1)
  }
  console.log('EXTRACTION: PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
