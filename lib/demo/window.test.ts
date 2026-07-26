import { afterEach, describe, expect, it } from 'vitest'
import { demoWindow } from './window'

/**
 * The switch that cuts the demo off. Its two failure modes are opposite and
 * both bad: closing early kills a live demo, staying open past the date is the
 * thing the user asked for protection from. So both directions are pinned.
 */

const NOW = new Date('2026-07-28T12:00:00Z')

afterEach(() => {
  delete process.env.DEMO_CLOSES_AT
})

describe('demoWindow', () => {
  it('stays open when no closing time is set', () => {
    const w = demoWindow(NOW)
    expect(w.closed).toBe(false)
    expect(w.closesAt).toBeNull()
    expect(w.msRemaining).toBeNull()
  })

  it('is open before the date, with time left', () => {
    process.env.DEMO_CLOSES_AT = '2026-07-28T18:00:00Z'
    const w = demoWindow(NOW)
    expect(w.closed).toBe(false)
    expect(w.msRemaining).toBe(6 * 3600 * 1000)
  })

  it('is closed on and after the date', () => {
    process.env.DEMO_CLOSES_AT = '2026-07-28T12:00:00Z'
    expect(demoWindow(NOW).closed).toBe(true)
    process.env.DEMO_CLOSES_AT = '2026-07-27T12:00:00Z'
    expect(demoWindow(NOW).closed).toBe(true)
    expect(demoWindow(NOW).msRemaining).toBe(0)
  })

  it('fails open on an unreadable date rather than closing by accident', () => {
    process.env.DEMO_CLOSES_AT = 'next tuesday'
    expect(demoWindow(NOW).closed).toBe(false)
  })

  it('reads the date every call, so moving it needs no redeploy', () => {
    process.env.DEMO_CLOSES_AT = '2026-07-27T12:00:00Z'
    expect(demoWindow(NOW).closed).toBe(true)
    process.env.DEMO_CLOSES_AT = '2026-08-27T12:00:00Z'
    expect(demoWindow(NOW).closed).toBe(false)
  })
})
