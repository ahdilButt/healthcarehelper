'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Copy, Send } from 'lucide-react'
import type { Citation, TimelineItem } from '@/lib/types'
import { Card, Meta, PageTitle, SourceChip, Spinner } from '@/components/ui/primitives'
import { DetailSheet } from '@/components/timeline/detail-sheet'
import { cn } from '@/lib/utils'

export interface AskMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations: Citation[]
  gpQuestions: string[]
}

/**
 * The Ask tab (SPEC-FINAL §5), in the design lane's shape. One conversation per
 * person, every answer carrying the letters it came from, and a closing card of
 * questions worth asking a clinician — because preparing that conversation,
 * not replacing it, is the whole point of this screen.
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
  const [copied, setCopied] = useState<string | null>(null)
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

  const copyQuestions = (id: string, questions: string[]) => {
    navigator.clipboard.writeText(questions.map((q) => `• ${q}`).join('\n')).then(
      () => {
        setCopied(id)
        setTimeout(() => setCopied(null), 1800)
      },
      () => setCopied(null)
    )
  }

  const suggestions = [
    `What's actually wrong with ${personName}'s kidneys?`,
    'What changed at the last heart clinic appointment?',
    `What is ${personName} taking, and what is each one for?`,
  ]

  return (
    <div className="flex min-h-[calc(100dvh-9rem)] flex-col">
      <div className="pt-1">
        <PageTitle>Ask about {personName}</PageTitle>
        <Meta className="mt-1">Answers come from the letters in {personName}&rsquo;s story</Meta>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-4">
        {messages.map((m) =>
          m.role === 'user' ? (
            <p
              key={m.id}
              className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[15px] text-primary-foreground text-pretty"
            >
              {m.content}
            </p>
          ) : (
            <div key={m.id} className="flex flex-col gap-3">
              <Card className="mr-auto max-w-full rounded-2xl rounded-bl-md">
                {m.content.split(/\n{2,}/).map((para, i) => (
                  <p
                    key={i}
                    className={cn('text-[15px] leading-relaxed text-pretty', i > 0 && 'mt-3')}
                  >
                    <Prose text={para} />
                  </p>
                ))}
                {m.citations.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                    {m.citations.map((c) => (
                      <SourceChip
                        key={`${c.factTable}:${c.factId}`}
                        label={c.label}
                        onClick={() => setDetail(itemFor(c, personId))}
                      />
                    ))}
                  </div>
                )}
              </Card>

              {m.gpQuestions.length > 0 && (
                <Card tone="accent">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[17px] font-semibold text-pretty">
                      Questions you might ask the GP
                    </h2>
                    <button
                      type="button"
                      onClick={() => copyQuestions(m.id, m.gpQuestions)}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-primary active:bg-primary/10"
                    >
                      <Copy className="size-4" />
                      <span className="sr-only">Copy these questions</span>
                    </button>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2">
                    {m.gpQuestions.map((q) => (
                      <li key={q} className="flex gap-2 text-[15px] leading-relaxed text-pretty">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                        {q}
                      </li>
                    ))}
                  </ul>
                  <p aria-live="polite" className="mt-3 text-[13px] text-primary">
                    {copied === m.id ? 'Copied — ready to paste or read out' : ' '}
                  </p>
                </Card>
              )}
            </div>
          )
        )}

        {messages.length === 0 && (
          <Card>
            <p className="text-[15px] leading-relaxed text-pretty">
              Ask anything about the letters in {personName}&rsquo;s story. Every answer says which
              letter it came from, so you can read it yourself.
            </p>
          </Card>
        )}

        {busy && <Spinner label={`Reading ${personName}’s letters…`} />}
        {error && <p className="text-[15px] text-alert">{error}</p>}
        <div ref={foot} className="h-px" />
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-border bg-background px-4 pt-3 pb-2">
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={busy}
              className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-muted-foreground active:bg-muted disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            ask(question)
          }}
        >
          <label htmlFor="hh-ask" className="sr-only">
            Your question
          </label>
          <input
            id="hh-ask"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={`Ask anything about ${personName}'s care`}
            className="min-h-12 flex-1 rounded-full border border-border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary"
          />
          <button
            type="submit"
            disabled={busy || !question.trim()}
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:bg-primary/90 disabled:opacity-50"
          >
            <Send className="size-5" />
            <span className="sr-only">Send</span>
          </button>
        </form>
        {/* SPEC-FINAL §5: this line is permanent, not a dismissible notice. */}
        <p className="mt-2 text-center text-[13px] text-muted-foreground">
          Explains and prepares questions — never diagnoses.
        </p>
      </div>

      {detail && <DetailSheet item={detail} onClose={() => setDetail(null)} onChanged={() => {}} />}
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
