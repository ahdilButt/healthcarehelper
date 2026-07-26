'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Card, Meta, PageTitle } from '@/components/ui/primitives'
import { ShoeboxIllustration } from '@/components/ui/illustrations'

/**
 * Three screens then the camera (SPEC-FINAL §9).
 * "Whose care?" → their name → "Add the first letter".
 */
export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<0 | 1 | 2>(0)
  const [forSelf, setForSelf] = useState(false)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function create() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/persons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        displayName: name.trim(),
        managingNote: note.trim() || undefined,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      setError(body?.error?.message ?? 'Something went wrong.')
      setBusy(false)
      return
    }
    setStep(2)
    setBusy(false)
  }

  return (
    <main className="hh-shell flex min-h-dvh flex-col justify-center gap-6 px-5 py-10">
      {step === 0 && (
        <>
          <PageTitle>Whose care are you managing?</PageTitle>
          <div className="flex flex-col gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                setForSelf(false)
                setStep(1)
              }}
            >
              Someone I care for
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setForSelf(true)
                setStep(1)
              }}
            >
              Me
            </Button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <PageTitle>{forSelf ? 'A little about you' : 'What do you call them?'}</PageTitle>
          <Card>
            <div className="flex flex-col gap-3">
              <label htmlFor="name" className="text-[15px] font-medium">
                {forSelf ? 'Your name' : 'Name'}
              </label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={forSelf ? 'Your first name' : 'Dad'}
                className="min-h-[44px] rounded-xl border border-border bg-white px-3 text-[15px] outline-none focus:border-primary"
              />
              <label htmlFor="note" className="mt-2 text-[15px] font-medium">
                {forSelf ? 'What are you managing?' : 'What are they managing?'}{' '}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </label>
              <input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Heart failure and diabetes"
                className="min-h-[44px] rounded-xl border border-border bg-white px-3 text-[15px] outline-none focus:border-primary"
              />
              {error && <p className="text-[13px] text-alert">{error}</p>}
              <Button onClick={create} disabled={busy || !name.trim()}>
                {busy ? 'Setting up…' : 'Continue'}
              </Button>
            </div>
          </Card>
        </>
      )}

      {step === 2 && (
        <div className="flex flex-col items-center gap-5 text-center">
          <ShoeboxIllustration />
          <PageTitle>Add the first letter</PageTitle>
          <Meta className="max-w-[30ch]">
            Photograph it and watch {possessive(name)} story build itself.
          </Meta>
          <Button onClick={() => router.push('/timeline?add=1')}>Add a letter</Button>
          <Button variant="ghost" onClick={() => router.push('/timeline')}>
            Not now
          </Button>
        </div>
      )}
    </main>
  )
}

/** "Dad's story", "Jess's story" — and "their story" before there is a name. */
function possessive(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'their'
  return trimmed.endsWith('s') ? `${trimmed}’` : `${trimmed}’s`
}
