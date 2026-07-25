import { NextResponse } from 'next/server'
import { route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import type { Citation } from '@/lib/types'

/** GET /api/conversations/:personId — one conversation surface per person. */

interface MessageRow {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[] | null
  gp_questions: string[] | null
  created_at: string
}

export const GET = route(async (_req: Request, ctx: RouteContext<'/api/conversations/[personId]'>) => {
  const { personId } = await ctx.params
  const member = await requireMember(personId)
  const db = member.db

  const { data: conversations } = await db
    .from('conversations')
    .select('id, created_at')
    .eq('person_id', personId)
    .order('created_at', { ascending: true })

  const ids = (conversations ?? []).map((c) => c.id)
  const { data: messages } = ids.length
    ? await db
        .from('messages')
        .select('id, conversation_id, role, content, citations, gp_questions, created_at')
        .in('conversation_id', ids)
        .order('created_at', { ascending: true })
    : { data: [] }

  const byConversation = new Map<string, MessageRow[]>()
  for (const m of (messages ?? []) as MessageRow[]) {
    const list = byConversation.get(m.conversation_id) ?? []
    list.push(m)
    byConversation.set(m.conversation_id, list)
  }

  return NextResponse.json({
    conversations: (conversations ?? []).map((c) => ({
      id: c.id,
      messages: (byConversation.get(c.id) ?? []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        citations: m.citations ?? [],
        gpQuestions: m.gp_questions ?? [],
        createdAt: m.created_at,
      })),
    })),
  })
})
