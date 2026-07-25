'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, ExternalLink, Power, RefreshCw } from 'lucide-react'
import { BottomSheet } from '@/components/bottom-sheet'
import { FakeQr } from '@/components/fake-qr'
import { Card, Meta, PillButton, StatusPill } from '@/components/ui-bits'
import { openLog, shareLink } from '@/lib/mock'

export function CreateLinkFlow({
  slug,
  title,
  expiry,
}: {
  slug: string
  title: string
  expiry: string
}) {
  const [open, setOpen] = useState(false)
  const [live, setLive] = useState(true)
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(`https://${shareLink}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  return (
    <>
      <div className="mt-6 flex flex-col gap-3">
        <PillButton className="w-full" onClick={() => setOpen(true)}>
          Create link
        </PillButton>
        <Meta className="text-center">{expiry}</Meta>
      </div>

      <BottomSheet open={open} onClose={() => setOpen(false)} title={`${title} is ready`}>
        <div className="mx-auto w-full max-w-[240px] rounded-lg border border-border p-2">
          <FakeQr />
        </div>
        <Meta className="mt-3 text-center">Hold a phone camera up to this, or send the link.</Meta>

        <div className="mt-5 flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-3">
          <span className="min-w-0 flex-1 truncate text-[15px]">{shareLink}</span>
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
          {copied ? 'Copied' : '\u00A0'}
        </p>

        <div className="mt-2 flex items-center justify-between gap-3">
          <Meta>{live ? expiry : 'Turned off — nobody can open it'}</Meta>
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
          <ul className="mt-3 flex flex-col gap-2">
            {openLog.map((entry) => (
              <li key={entry.when} className="flex items-center justify-between gap-3 text-[15px]">
                <span className="min-w-0 truncate">{entry.who}</span>
                <span className="shrink-0 text-[13px] text-muted-foreground">{entry.when}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <PillButton variant="plain" className="flex-1" onClick={() => setLive(true)}>
              <RefreshCw className="size-4" />
              Renew
            </PillButton>
            <PillButton variant="plain" className="flex-1" onClick={() => setLive(false)}>
              <Power className="size-4" />
              Turn off
            </PillButton>
          </div>
        </Card>
      </BottomSheet>
    </>
  )
}
