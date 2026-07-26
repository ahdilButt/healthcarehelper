'use client'

import { useState } from 'react'
import { Check, Copy, X } from 'lucide-react'
import { Button, Meta } from '@/components/ui/primitives'
import { cn } from '@/lib/utils'

type Role = 'patient' | 'carer'

/**
 * Bringing someone else in (SPEC-FINAL §2, §12 Stage 1.1).
 *
 * The API and the accept page have existed since the auth stage; nothing in
 * the app ever called them, so the only way to give a second person access was
 * to forward your own sign-in link — which does not add them, it makes them
 * you. This is the difference between "join my record" and "become me".
 *
 * The invite is single-use and expires, and whoever accepts it signs in with
 * their OWN address. Two people, two accounts, one record.
 */
export function InvitePanel({
  personId,
  personName,
  onClose,
}: {
  personId: string
  personName: string
  onClose: () => void
}) {
  const [role, setRole] = useState<Role>('carer')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')

  const create = () => {
    setBusy(true)
    setError('')
    fetch('/api/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ personId, role }),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as
          | { inviteUrl?: string; error?: { message?: string } }
          | null
        if (!res.ok || !body?.inviteUrl) {
          throw new Error(body?.error?.message ?? 'Could not make that invite.')
        }
        setUrl(body.inviteUrl)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'That did not work.'))
      .finally(() => setBusy(false))
  }

  const choices: { role: Role; label: string; blurb: string }[] = [
    {
      role: 'patient',
      label: `They are ${personName}`,
      blurb: 'For their own phone. They can add letters and tick off medicines.',
    },
    {
      role: 'carer',
      label: `They help look after ${personName}`,
      blurb: 'A sibling, a partner, a carer. The same access, on their own sign-in.',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/25"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Invite someone"
        className="relative w-full max-w-[520px] rounded-t-[24px] bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+20px)]"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
        >
          <X className="size-5" />
          <span className="sr-only">Close</span>
        </button>

        <h2 className="text-[17px] font-semibold">Invite someone</h2>
        <Meta className="mt-1">
          They sign in with their own email and see {personName}&rsquo;s story on their own phone.
        </Meta>

        {url ? (
          <div className="mt-4">
            <p className="rounded-xl bg-muted p-3 text-[13px] break-all">{url}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(url).then(
                    () => setCopied(true),
                    () => setCopied(false)
                  )
                }}
              >
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? 'Copied' : 'Copy the link'}
              </Button>
              <Button variant="ghost" onClick={onClose}>
                Done
              </Button>
            </div>
            <Meta className="mt-3">
              Send it however you like. It works once, expires in three days, and asks them for
              their own email — so it can never sign them in as you.
            </Meta>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-2">
              {choices.map((c) => (
                <button
                  key={c.role}
                  type="button"
                  onClick={() => setRole(c.role)}
                  aria-pressed={role === c.role}
                  className={cn(
                    'rounded-lg border p-4 text-left',
                    role === c.role ? 'border-primary bg-accent' : 'border-border bg-card'
                  )}
                >
                  <span className="block text-[15px] font-semibold">{c.label}</span>
                  <span className="mt-1 block text-[13px] text-muted-foreground">{c.blurb}</span>
                </button>
              ))}
            </div>
            <Button className="mt-4" onClick={create} disabled={busy}>
              {busy ? 'Making the link…' : 'Make an invite link'}
            </Button>
          </>
        )}

        {error && <p className="mt-3 text-[13px] text-alert">{error}</p>}
      </div>
    </div>
  )
}
