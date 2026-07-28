'use client'

import { useState } from 'react'
import { PillButton } from '@/components/ui-bits'

/**
 * The way in. For everyone arriving from a link, this is the only way in.
 *
 * It provisions a private copy of the demo record behind an anonymous session
 * (POST /api/demo/guest), which takes a second or two — so the button says
 * what it is doing rather than sitting there looking broken.
 *
 * A hard navigation, not a router push: the session cookie was set by that
 * response, and the signed-in shell has to be rendered by a request carrying
 * it.
 */
export function TryDemoButton({
  className,
  style,
  variant = 'primary',
  label = 'Try it — no account needed',
  onFailure,
}: {
  className?: string
  style?: React.CSSProperties
  variant?: 'primary' | 'quiet' | 'plain'
  label?: string
  /** Lets the sign-in page reveal the email form when guest access is off. */
  onFailure?: () => void
}) {
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
        onFailure?.()
        return
      }
      window.location.href = '/timeline'
    } catch {
      setState('error')
      setMessage('We could not open the demo just now.')
      onFailure?.()
    }
  }

  return (
    <>
      <PillButton
        variant={variant}
        className={className}
        style={style}
        onClick={start}
        disabled={state === 'working'}
      >
        {state === 'working' ? 'Setting up your record…' : label}
      </PillButton>
      {state === 'error' && (
        <p className="text-center text-[13px] text-alert" role="alert">
          {message}
        </p>
      )}
    </>
  )
}
