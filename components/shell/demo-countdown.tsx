'use client'

import { useEffect, useState } from 'react'

/**
 * "This is a demo — it closes in 3 days."
 *
 * Someone who uploads their father's discharge summary deserves to know the
 * thing they are putting it into has an end date, before they do it rather
 * than after. The proxy enforces the same date; this is the honest warning.
 *
 * The closing instant arrives as a prop because DEMO_CLOSES_AT is a server
 * variable — deliberately not NEXT_PUBLIC, so the switch cannot be read (or
 * cached into a bundle) from the browser.
 */

/** "2 days", "6 hours", "20 minutes", "under a minute". */
function remaining(ms: number): string {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'under a minute'
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} hour${hours === 1 ? '' : 's'}`
  return `${Math.floor(hours / 24)} days`
}

export function DemoCountdown({ closesAt }: { closesAt: string }) {
  // Starts null and fills in after mount: the server and the browser would
  // otherwise disagree about "now" and React would call that a hydration bug.
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    const end = new Date(closesAt).getTime()
    const tick = () => {
      const left = end - Date.now()
      setLabel(left <= 0 ? null : remaining(left))
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [closesAt])

  if (!label) return null

  return (
    <p className="bg-warn-wash px-4 py-1.5 text-center text-[13px] leading-[1.4] text-warn">
      This is a demo. It closes in {label}, and the records go with it.
    </p>
  )
}
