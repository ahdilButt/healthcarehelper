import { redirect } from 'next/navigation'
import { currentPerson } from '@/lib/person'
import { supabaseServer } from '@/lib/supabase/server'
import { AskThread, type AskMessage } from '@/components/ask/ask-thread'
import type { Citation } from '@/lib/types'

interface MessageRow {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[] | null
  gp_questions: string[] | null
}

/**
 * One conversation surface per person (SPEC-FINAL §5): the thread they were
 * last in is already on screen, so a question asked this morning is still there
 * when they come back to it after the appointment.
 */
export default async function AskPage() {
  const { person } = await currentPerson()
  if (!person) redirect('/onboarding')

  const db = await supabaseServer()
  const { data: conversation } = await db
    .from('conversations')
    .select('id')
    .eq('person_id', person.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: rows } = conversation
    ? await db
        .from('messages')
        .select('id, role, content, citations, gp_questions')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true })
    : { data: [] }

  const messages: AskMessage[] = ((rows ?? []) as MessageRow[]).map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    citations: m.citations ?? [],
    gpQuestions: m.gp_questions ?? [],
  }))

  return (
    <AskThread
      personId={person.id}
      personName={person.displayName}
      initialMessages={messages}
      initialConversationId={conversation?.id ?? null}
    />
  )
}
