'use client'

import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
import { Button, Card, CardHeader, Meta, PageTitle } from '@/components/ui/primitives'
import { EnvelopeIllustration } from '@/components/ui/illustrations'
import { PRODUCT_NAME } from '@/components/brand-lockup'

/** Magic-link auth. No passwords anywhere in the product (SPEC-FINAL §9). */
export default function SignInPage() {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')

  /**
   * Some magic links land as an implicit-flow fragment
   * (#access_token=…&refresh_token=…) rather than the PKCE ?code= that
   * /auth/callback handles: links minted server-side have no code verifier,
   * and neither does a link opened in a different browser from the one that
   * asked for it — which is exactly what happens when Amira forwards one to
   * Dad. Adopt the session here so both routes in work.
   */
  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return
    const params = new URLSearchParams(hash.slice(1))
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) return

    void (async () => {
      setState('sending')
      const { error } = await supabaseBrowser().auth.setSession({ access_token, refresh_token })
      if (error) {
        setState('error')
        setMessage(error.message)
        return
      }
      history.replaceState(null, '', window.location.pathname)
      const next = new URLSearchParams(window.location.search).get('next') ?? '/timeline'
      window.location.replace(next)
    })()
  }, [])

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
        <PageTitle>{PRODUCT_NAME}</PageTitle>
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
              className="min-h-[44px] rounded-xl border border-border bg-white px-3 text-[15px] outline-none focus:border-primary"
            />
            <Button type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a link'}
            </Button>
            {state === 'error' && (
              <p className="text-[13px] text-alert">{message}</p>
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
