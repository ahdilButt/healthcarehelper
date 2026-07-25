'use client'

import { useEffect, useRef, useState } from 'react'
import { Copy, Send } from 'lucide-react'
import { Card, Meta, PageTitle, SourceChip } from '@/components/ui-bits'
import { askSuggestions, askThread, type AskMessage } from '@/lib/mock'

const cannedReply: Omit<AskMessage, 'id'> = {
  from: 'helper',
  text:
    'Here is what the letters say about that. Dad’s heart tablets were adjusted on 12 May and the clinic asked for a blood test six weeks later, so the plan is already written down — nothing new needs deciding today.\n\nIf something feels different at home, like more breathlessness or swollen ankles, that is worth ringing the surgery about rather than waiting.',
  sources: ['Kidney letter · 12 May'],
  questions: [
    'Has the follow-up blood test been booked yet?',
    'What changes at home should we ring about?',
  ],
}

export function AskThread() {
  const [messages, setMessages] = useState<AskMessage[]>(askThread)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  function send(text: string) {
    const value = text.trim()
    if (!value) return
    const stamp = Date.now()
    setMessages((m) => [...m, { id: `you-${stamp}`, from: 'you', text: value }])
    setDraft('')
    window.setTimeout(() => {
      setMessages((m) => [...m, { ...cannedReply, id: `helper-${stamp}` }])
    }, 600)
  }

  async function copyQuestions(id: string, questions: string[]) {
    try {
      await navigator.clipboard.writeText(questions.map((q) => `• ${q}`).join('\n'))
      setCopied(id)
      window.setTimeout(() => setCopied(null), 1800)
    } catch {
      setCopied(null)
    }
  }

  return (
    <div className="-mb-36 flex min-h-[calc(100dvh-9rem)] flex-col">
      <div className="px-5">
        <PageTitle className="pt-1">Ask about Dad</PageTitle>
        <Meta className="mt-1">Answers come from the letters in his story</Meta>
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-4 px-5">
        {messages.map((message) =>
          message.from === 'you' ? (
            <p
              key={message.id}
              className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[15px] text-primary-foreground text-pretty"
            >
              {message.text}
            </p>
          ) : (
            <div key={message.id} className="flex flex-col gap-3">
              <Card className="mr-auto max-w-full rounded-2xl rounded-bl-md">
                {message.text.split('\n\n').map((para, i) => (
                  <p
                    key={i}
                    className={`text-[15px] leading-relaxed text-pretty ${i > 0 ? 'mt-3' : ''}`}
                  >
                    {para}
                  </p>
                ))}
                {message.sources ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/70 pt-3">
                    {message.sources.map((source) => (
                      <SourceChip key={source} label={source} />
                    ))}
                  </div>
                ) : null}
              </Card>

              {message.questions ? (
                <Card tone="accent">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-[17px] font-semibold text-pretty">
                      Questions you might ask the GP
                    </h2>
                    <button
                      type="button"
                      onClick={() => copyQuestions(message.id, message.questions ?? [])}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-primary active:bg-primary/10"
                    >
                      <Copy className="size-4" />
                      <span className="sr-only">Copy these questions</span>
                    </button>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2">
                    {message.questions.map((q) => (
                      <li key={q} className="flex gap-2 text-[15px] leading-relaxed text-pretty">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                        {q}
                      </li>
                    ))}
                  </ul>
                  <p aria-live="polite" className="mt-3 text-[13px] text-primary">
                    {copied === message.id ? 'Copied — ready to paste or read out' : '\u00A0'}
                  </p>
                </Card>
              ) : null}
            </div>
          ),
        )}
        <div ref={endRef} className="h-px scroll-mb-72" />
      </div>

      <div className="sticky bottom-[calc(3.75rem+max(0.5rem,env(safe-area-inset-bottom)))] mt-6 border-t border-border bg-background px-5 pb-3 pt-3">
        <div className="no-scrollbar -mx-5 mb-3 flex gap-2 overflow-x-auto px-5">
          {askSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              className="shrink-0 rounded-full border border-border bg-card px-3.5 py-2 text-[13px] font-medium text-muted-foreground active:bg-muted"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(draft)
          }}
          className="flex items-end gap-2"
        >
          <label className="sr-only" htmlFor="ask-input">
            Ask about Dad
          </label>
          <input
            id="ask-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                e.preventDefault()
                send(draft)
              }
            }}
            placeholder="Ask anything about Dad's care"
            className="min-h-12 flex-1 rounded-full border border-border bg-card px-4 text-[15px] outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary"
          />
          <button
            type="submit"
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:bg-primary/90"
          >
            <Send className="size-5" />
            <span className="sr-only">Send</span>
          </button>
        </form>
        <p className="mt-2 text-center text-[13px] text-muted-foreground">
          Explains and prepares questions — never diagnoses.
        </p>
      </div>
    </div>
  )
}
