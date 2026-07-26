import { NextResponse } from 'next/server'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { RefusalError } from '@/lib/ai/claude'
import { buildRecordContext } from '@/lib/ask/context'
import { answerQuestion, type Turn } from '@/lib/ask/answer'

const MAX_QUESTION = 1000
/** Enough for the thread to keep its thread, short enough to stay affordable. */
const HISTORY_TURNS = 12

/**
 * POST /api/ask — the Q&A brain (SPEC-FINAL §5).
 *
 * The record is rebuilt per question rather than cached in memory: a letter
 * added or a fact corrected two seconds ago must be in the next answer, and a
 * serverless instance cannot be trusted to be the same one twice.
 */
export const POST = route(async (req: Request) => {
  const body = await readJson<{
    personId?: string
    conversationId?: string
    question?: string
    /** Asked out loud: the answer is spoken, so it is written to be heard. */
    spoken?: boolean
  }>(req)

  const personId = String(required(body.personId, 'personId'))
  const question = String(required(body.question, 'question')).trim()
  if (!question) throw new ApiError('invalid_input', 'Type a question first.')
  if (question.length > MAX_QUESTION) {
    throw new ApiError('invalid_input', 'That is a very long question — try it in shorter pieces.')
  }

  const member = await requireMember(personId)
  const db = member.db

  const { data: person } = await db
    .from('persons')
    .select('display_name')
    .eq('id', personId)
    .maybeSingle()
  const personName = person?.display_name ?? 'They'

  let conversationId = body.conversationId ?? null
  if (conversationId) {
    // A conversation id from elsewhere must never pull another person's thread.
    const { data: existing } = await db
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('person_id', personId)
      .maybeSingle()
    if (!existing) throw new ApiError('not_found', 'That conversation was not found.')
  } else {
    const { data: created, error } = await db
      .from('conversations')
      .insert({ person_id: personId, created_by: member.userId })
      .select('id')
      .single()
    if (error || !created) throw new ApiError('processing_failed', 'Could not start that.')
    conversationId = created.id
  }

  // Read the thread before the new question joins it, so it is asked once.
  const { data: prior } = await db
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(HISTORY_TURNS)
  const history = ((prior ?? []) as Turn[]).slice().reverse()

  await db.from('messages').insert({ conversation_id: conversationId, role: 'user', content: question })

  const record = await buildRecordContext(db, personId, personName)

  let answer
  try {
    answer = await answerQuestion(record, history, question, personName, {
      spoken: Boolean(body.spoken),
    })
  } catch (e) {
    if (e instanceof RefusalError) {
      throw new ApiError('processing_failed', 'That one is better asked of a clinician directly.')
    }
    console.error('[ask] failed', e instanceof Error ? e.message : e)
    throw new ApiError('processing_failed', 'We could not answer that just now. Try again shortly.')
  }

  await db.from('messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content: answer.content,
    citations: answer.citations,
    gp_questions: answer.gpQuestions,
  })

  return NextResponse.json({
    conversationId,
    message: {
      content: answer.content,
      citations: answer.citations,
      gpQuestions: answer.gpQuestions,
    },
  })
})
