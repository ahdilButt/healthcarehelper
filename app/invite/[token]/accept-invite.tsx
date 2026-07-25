'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/primitives'

export default function AcceptInvite({ token }: { token: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function accept() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      setError(body?.error?.message ?? 'Could not join.')
      setBusy(false)
      return
    }
    router.push('/timeline')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={accept} disabled={busy}>
        {busy ? 'Joining…' : 'Join'}
      </Button>
      {error && <p className="text-[13px] text-alert">{error}</p>}
    </div>
  )
}
