import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'
import { buildRecordContext } from '../lib/ask/context'
import { answerQuestion } from '../lib/ask/answer'

/**
 * Ask a question straight at the brain, without a browser session.
 *
 * The route is where membership is enforced; this is the bench underneath it,
 * for rehearsing the demo answers and for checking the SPEC-FINAL §12 line
 * ("the kidneys question cites docs 6/7/8, an absent topic gets the honest
 * answer") without clicking through the app. Service-role, scripts-only —
 * never import this path from app code.
 *
 *   npm run ask -- "What's actually wrong with Dad's kidneys?"
 */
async function main() {
  const question = process.argv.slice(2).join(' ').trim()
  if (!question) {
    console.error('Usage: npm run ask -- "your question"')
    process.exit(1)
  }

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    { auth: { persistSession: false } }
  )

  const { data: people } = await db.from('persons').select('id, display_name')
  const person = (people ?? []).find((p) => p.display_name !== 'Amira') ?? (people ?? [])[0]
  if (!person) throw new Error('No person in the database — run npm run seed first.')

  const record = await buildRecordContext(db, person.id, person.display_name)
  console.log(
    `record: ${record.documents} letters, ${record.facts} facts, ${record.catalogue.length} chars\n`
  )

  const answer = await answerQuestion(record, [], question, person.display_name)

  console.log(`Q: ${question}\n`)
  console.log(answer.content)
  console.log(`\nin record: ${answer.inRecord}`)
  console.log('\ncitations:')
  for (const c of answer.citations) console.log(`  · ${c.factTable} — ${c.label}`)
  console.log('\nquestions for the GP:')
  for (const q of answer.gpQuestions) console.log(`  • ${q}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
