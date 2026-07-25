'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink, Power, RefreshCw } from 'lucide-react'
import { BottomSheet } from '@/components/bottom-sheet'
import { FakeQr } from '@/components/fake-qr'
import { Card, Meta, PillButton, StatusPill } from '@/components/ui-bits'
import { openLog, shareLinkFor, type CapsulePreset } from '@/lib/mock'

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return
    }
  } catch {
    // The async clipboard is blocked in some embedded previews — fall through.
  }
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(field)
  if (!ok) throw new Error('copy failed')
}

export function CreateLinkFlow({
  slug,
  title,
  expiry,
}: {
  slug: CapsulePreset['slug']
  title: string
  expiry: string
}) {
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState(true)
  const [renewed, setRenewed] = useState(false)
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)

  const link = shareLinkFor(slug)

  async function copy() {
    try {
      await copyText(`https://${link}`)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
    window.setTimeout(() => setCopied(null), 2000)
  }

  function renew() {
    setLive(true)
    setRenewed(true)
    window.setTimeout(() => setRenewed(false), 3000)
  }

  const statusLine = !live
    ? 'Turned off — nobody can open it'
    : renewed
      ? `Renewed just now — ${expiry.toLowerCase()}`
      : expiry

  return (
    <>
      <div className="mt-6 flex flex-col gap-3">
        <PillButton className="w-full" onClick={() => setOpen(true)}>
          Create link
        </PillButton>
        <Meta className="text-center">{expiry}</Meta>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={`${title} is ready`}>
        <div className="mx-auto w-full max-w-[240px] rounded-lg border border-border p-3">
          <FakeQr value={link} className={live ? undefined : 'opacity-25'} />
        </div>
        <Meta className="mt-3 text-center">
          {live
            ? 'Hold a phone camera up to this, or send the link.'
            : 'This code is turned off. Turn it back on to let people in again.'}
        </Meta>

        <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[15px]">{link}</span>
          <button
            type="button"
            onClick={copy}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-primary active:bg-primary/10"
          >
            <Copy className="size-4" />
            <span className="sr-only">Copy the link</span>
          </button>
        </div>
        <p aria-live="polite" className="mt-2 text-center text-[13px] text-primary">
          {copied === 'yes'
            ? 'Copied'
            : copied === 'no'
              ? 'Copy it by hand — your browser blocked copying'
              : '\u00A0'}
        </p>

        <div className="mt-2 flex items-center justify-between gap-3">
          <Meta>{statusLine}</Meta>
          <StatusPill tone={live ? 'good' : 'warn'}>{live ? 'Open' : 'Off'}</StatusPill>
        </div>

        <PillButton
          as={Link}
          href={`/c/demo?v=${slug}`}
          variant="quiet"
          className="mt-4 w-full"
          onClick={() => setOpen(false)}
        >
          <ExternalLink className="size-4" />
          See the page they&apos;ll open
        </PillButton>

        <Card className="mt-4">
          <h3 className="text-[17px] font-semibold">Who has opened it</h3>
          <ul className="mt-3 flex flex-col gap-3">
            {openLog.map((entry) => (
              <li key={entry.when} className="flex items-start justify-between gap-3 text-[15px]">
                <span className="min-w-0">
                  <span className="block truncate">{entry.who}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {entry.where}
                  </span>
                </span>
                <span className="shrink-0 text-[13px] text-muted-foreground">{entry.when}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <PillButton variant="plain" className="flex-1" onClick={renew}>
              <RefreshCw className="size-4" />
              Renew
            </PillButton>
            <PillButton variant="plain" className="flex-1" onClick={() => setLive((on) => !on)}>
              <Power className="size-4" />
              {live ? 'Turn off' : 'Turn back on'}
            </PillButton>
          </div>
          <p aria-live="polite" className="mt-3 text-[13px] text-muted-foreground">
            {renewed ? 'The clock has been reset from today.' : '\u00A0'}
          </p>
        </Card>
      </BottomSheet>
    </>
  )
}
