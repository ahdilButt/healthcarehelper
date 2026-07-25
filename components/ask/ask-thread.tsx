'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Citation, TimelineItem } from '@/lib/types'
import { Button, Card, CardHeader, Meta, SourceChip, Spinner } from '@/components/ui/primitives'
import { DetailSheet } from '@/components/timeline/detail-sheet'

export interface AskMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  gpQuestions: string[]
}

/**
 * The Ask tab (SPEC-FINAL §5). One conversation per person, every answer
 * carrying the letters it came from, and a closing card of questions worth
 * asking a clinician — because preparing that conversation, not replacing it,
 * is the whole point of this screen.
 */
export function AskThread({
  personId,
  personName,
  initialMessages,
  initialConversationId,
}: {
  personId: string
  personName: string
  initialMessages: AskMessage[]
  initialConversationId: string | null
}) {
  const [messages, setMessages] = useState(initialMessages)
  const [conversationId, setConversationId] = useState(initialConversationId)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<TimelineItem | null>(null)
  const foot = useRef<HTMLDivElement>(null)
  const live = useRef(true)

  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
    }
  }, [])

  useEffect(() => {
    foot.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
  }, [messages, busy])

  const ask = useCallback(
    (text: string) => {
      const asked = text.trim()
      if (!asked || busy) return
      setBusy(true)
      setError('')
      setQuestion('')
      setMessages((prev) => [
        ...prev,
        { id: `local-${prev.length}`, role: 'user', content: asked, citations: [], gpQuestions: [] },
      ])

      fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ personId, conversationId, question: asked }),
      })
        .then(async (res) => {
          const body = (await res.json().catch(() => null)) as {
            conversationId?: string
            message?: { content: string; citations: Citation[]; gpQuestions: string[] }
            error?: { message?: string }
          } | null
          if (!res.ok || !body?.message) {
            throw new Error(body?.error?.message ?? 'We could not answer that just now.')
          }
          if (!live.current) return
          setConversationId(body.conversationId ?? conversationId)
          setMessages((prev) => [
            ...prev,
            {
              id: `answer-${prev.length}`,
              role: 'assistant',
              content: body.message!.content,
              citations: body.message!.citations ?? [],
              gpQuestions: body.message!.gpQuestions ?? [],
            },
          ])
        })
        .catch((e: unknown) => {
          if (live.current) setError(e instanceof Error ? e.message : 'That did not work.')
        })
        .finally(() => {
          if (live.current) setBusy(false)
        })
    },
    [busy, conversationId, personId]
  )

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <div className="py-4">
        <h1 className="text-[28px] font-semibold leading-[1.2]">Ask</h1>
        <Meta className="mt-1">Anything about {personName}&rsquo;s letters.</Meta>
      </div>

      <div className="flex-1">
        {messages.length === 0 ? (
          <Opening personName={personName} onPick={ask} />
        ) : (
          <ul className="flex flex-col gap-4">
            {messages.map((m) =>
              m.role === 'user' ? (
                <li key={m.id} className="self-end max-w-[85%]">
                  <p className="rounded-[16px] bg-[var(--hh-accent-wash)] px-4 py-3 text-[15px] leading-[1.45]">
                    {m.content}
                  </p>
                </li>
              ) : (
                <li key={m.id}>
                  <Answer message={m} personId={personId} onOpen={setDetail} />
                </li>
              )
            )}
          </ul>
        )}

        {busy && (
          <div className="mt-4">
            <Spinner label={`Reading ${personName}’s letters…`} />
          </div>
        )}
        {error && <p className="mt-4 text-[15px] text-[var(--hh-red)]">{error}</p>}
        <div ref={foot} />
      </div>

      <form
        className="sticky bottom-0 -mx-4 mt-6 border-t border-[var(--hh-hairline)] bg-[var(--hh-bg)] px-4 pt-3 pb-2"
        onSubmit={(e) => {
          e.preventDefault()
          ask(question)
        }}
      >
        <label htmlFor="hh-ask" className="sr-only">
          Your question
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id="hh-ask"
            rows={1}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask(question)
              }
            }}
            placeholder="Ask a question"
            className="min-h-[44px] flex-1 resize-none rounded-[16px] border border-[var(--hh-hairline)] bg-[var(--hh-card)] px-4 py-3 text-[15px] leading-[1.45]"
          />
          <Button type="submit" disabled={busy || !question.trim()}>
            Ask
          </Button>
        </div>
        {/* SPEC-FINAL §5: this line is permanent, not a dismissible notice. */}
        <p className="mt-2 text-center text-[13px] leading-[1.4] text-[var(--hh-secondary)]">
          Explains and prepares questions — never diagnoses.
        </p>
      </form>

      {detail && <DetailSheet item={detail} onClose={() => setDetail(null)} onChanged={() => {}} />}
    </div>
  )
}

function Answer({
  message,
  personId,
  onOpen,
}: {
  message: AskMessage
  personId: string
  onOpen: (item: TimelineItem) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      {message.content.split(/\n{2,}/).map((para, i) => (
        <p key={i} className="text-[15px] leading-[1.45] whitespace-pre-wrap">
          <Prose text={para} />
        </p>
      ))}

      {message.citations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {message.citations.map((c) => (
            <SourceChip
              key={`${c.factTable}:${c.factId}`}
              label={c.label}
              onClick={() => onOpen(itemFor(c, personId))}
            />
          ))}
        </div>
      )}

      {message.gpQuestions.length > 0 && <GpQuestions questions={message.gpQuestions} />}
    </div>
  )
}

/**
 * The answers mark a turn with **double asterisks** and nothing else, so this
 * is the whole of the formatting the thread needs. Rendered as React nodes
 * rather than through any HTML, so nothing in an answer can ever become markup.
 */
function Prose({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </>
  )
}

/** The closing card (SPEC-FINAL §5) — soft, and copyable in one tap so it can
 * go into a notes app, a text to a sibling, or a pocket before an appointment. */
function GpQuestions({ questions }: { questions: string[] }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(questions.map((q) => `• ${q}`).join('\n'))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Card className="bg-[var(--hh-bg)]">
      <CardHeader>Questions you might ask the GP</CardHeader>
      <ul className="mt-2 flex flex-col gap-2">
        {questions.map((q) => (
          <li key={q} className="flex gap-2 text-[15px] leading-[1.45]">
            <span aria-hidden className="text-[var(--hh-accent)]">
              •
            </span>
            <span>{q}</span>
          </li>
        ))}
      </ul>
      <Button variant="ghost" className="mt-3" onClick={copy}>
        {copied ? 'Copied' : 'Copy these'}
      </Button>
    </Card>
  )
}

function Opening({ personName, onPick }: { personName: string; onPick: (q: string) => void }) {
  const suggestions = [
    `What&rsquo;s actually wrong with ${personName}&rsquo;s kidneys?`,
    'What changed at the last heart clinic appointment?',
    `What is ${personName} taking, and what is each one for?`,
  ].map((s) => s.replace(/&rsquo;/g, '’'))

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[15px] leading-[1.45]">
        Ask anything about the letters in {personName}&rsquo;s story. Every answer says which letter
        it came from, so you can read it yourself.
      </p>
      <ul className="flex flex-col gap-2">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick(s)}
              className="min-h-[44px] w-full rounded-[16px] border border-[var(--hh-hairline)] bg-[var(--hh-card)] px-4 py-3 text-left text-[15px] leading-[1.45]"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * A citation, in the shape the detail sheet already speaks. Tapping a chip has
 * to land on the same sheet the timeline opens — one component, so a source
 * always behaves the same way wherever it is met (SPEC-FINAL §5).
 */
function itemFor(c: Citation, personId: string): TimelineItem {
  const shared = {
    personId,
    humanTitle: c.label,
    payloadLine: '',
    date: '',
    confirmed: true,
    sourceChip: { documentId: c.documentId, label: c.label },
  }
  return c.factTable === 'documents'
    ? { ...shared, itemType: 'letter', id: c.documentId }
    : { ...shared, itemType: 'result', id: c.factId, factTable: c.factTable }
}
