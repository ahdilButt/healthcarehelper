'use client'

import { useState } from 'react'
import { PillButton } from '@/components/ui-bits'

/**
 * The way in for someone who arrived from a link and has no account.
 *
 * It provisions a private copy of the demo record behind an anonymous session
 * (POST /api/demo/guest), which takes a couple of seconds — so the button says
 * what it is doing rather than sitting there looking broken.
 *
 * A hard navigation, not a router push: the session cookie was set by that
 * response, and the signed-in shell has to be rendered by a request that
 * carries it.
 */
export function TryDemoButton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const [state, setState] = useState<'idle' | 'working' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function start() {
    setState('working')
    try {
      const res = await fetch('/api/demo/guest', { method: 'POST' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setState('error')
        setMessage(body?.error?.message ?? 'We could not open the demo just now.')
        return
      }
      window.location.href = '/timeline'
    } catch {
      setState('error')
      setMessage('We could not open the demo just now.')
    }
  }

  return (
    <>
      <PillButton
        variant="plain"
        className={className}
        style={style}
        onClick={start}
        disabled={state === 'working'}
      >
        {state === 'working' ? 'Setting up a record…' : 'Have a look around first'}
      </PillButton>
      {state === 'error' && (
        <p className="text-center text-[13px] text-alert" role="alert">
          {message}
        </p>
      )}
    </>
  )
}
