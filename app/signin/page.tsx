'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button, Card, CardHeader, Meta, PageTitle } from '@/components/ui/primitives'
import { EnvelopeIllustration } from '@/components/ui/illustrations'

/** Magic-link auth. No passwords anywhere in the product (SPEC-FINAL §9). */
export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setState('sending')
    const next = new URLSearchParams(window.location.search).get('next') ?? '/timeline'
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    })
    if (error) {
      setState('error')
      setMessage(error.message)
    } else {
      setState('sent')
    }
  }

  return (
    <main className="hh-shell flex min-h-dvh flex-col justify-center px-5 py-10">
      <div className="mb-8 flex flex-col items-center gap-4 text-center">
        <EnvelopeIllustration />
        <PageTitle>HealthcareHelper</PageTitle>
        <Meta className="max-w-[30ch]">
          Photograph the letters. The story assembles itself.
        </Meta>
      </div>

      {state === 'sent' ? (
        <Card>
          <CardHeader>Check your email</CardHeader>
          <Meta className="mt-2">
            We&apos;ve sent a link to <strong>{email}</strong>. Open it on this device and
            you&apos;re in — there&apos;s no password to remember.
          </Meta>
        </Card>
      ) : (
        <Card>
          <form onSubmit={send} className="flex flex-col gap-3">
            <label htmlFor="email" className="text-[15px] font-medium">
              Your email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-[44px] rounded-[10px] border border-[var(--hh-hairline)] bg-white px-3 text-[15px] outline-none focus:border-[var(--hh-accent)]"
            />
            <Button type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </Button>
            {state === 'error' && (
              <p className="text-[13px] text-[var(--hh-red)]">{message}</p>
            )}
          </form>
        </Card>
      )}

      <Meta className="mt-6 text-center">
        Explains and prepares questions — never diagnoses.
      </Meta>
    </main>
  )
}
