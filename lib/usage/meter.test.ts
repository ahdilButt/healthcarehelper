import { afterEach, describe, expect, it } from 'vitest'
import { budgets, costMicros, perUserKey } from './meter'

/**
 * The arithmetic behind the ceiling. If this is wrong the cap is wrong in
 * exactly the direction nobody notices: a spend that reads as smaller than it
 * was.
 */

afterEach(() => {
  delete process.env.DEMO_BUDGET_AI_USD
  delete process.env.DEMO_BUDGET_SPEECH_CHARS
})

describe('costMicros', () => {
  it('prices input and output at their different rates', () => {
    // 1M input at $5 + 1M output at $25 = $30.
    expect(costMicros({ input_tokens: 1_000_000, output_tokens: 1_000_000 })).toBe(30_000_000)
  })

  it('counts cache reads at a tenth of an input token', () => {
    const cached = costMicros({
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 1_000_000,
    })
    const fresh = costMicros({ input_tokens: 1_000_000, output_tokens: 0 })
    expect(cached * 10).toBe(fresh)
  })

  it('counts a cache write as more than the token it caches', () => {
    const write = costMicros({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 1_000_000,
    })
    expect(write).toBeGreaterThan(costMicros({ input_tokens: 1_000_000, output_tokens: 0 }))
  })

  it('treats absent cache fields as zero rather than NaN', () => {
    expect(costMicros({ input_tokens: 100, output_tokens: 100 })).toBe(3000)
    expect(
      costMicros({
        input_tokens: 100,
        output_tokens: 100,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      })
    ).toBe(3000)
  })

  it('never returns a fraction — the column holds integers', () => {
    const micros = costMicros({ input_tokens: 7, output_tokens: 3, cache_read_input_tokens: 11 })
    expect(Number.isInteger(micros)).toBe(true)
  })
})

describe('budgets', () => {
  it('defaults the voice budget to the 5000 characters that were asked for', () => {
    expect(budgets().speechChars).toBe(5000)
  })

  it('reads the environment at call time, so a ceiling can move mid-demo', () => {
    process.env.DEMO_BUDGET_AI_USD = '50'
    expect(budgets().aiUsd).toBe(50)
    process.env.DEMO_BUDGET_AI_USD = '5'
    expect(budgets().aiUsd).toBe(5)
  })

  it('falls back to the default on nonsense rather than to zero', () => {
    // Zero would refuse every request — a typo must not look like a spent budget.
    process.env.DEMO_BUDGET_AI_USD = 'twenty'
    expect(budgets().aiUsd).toBe(25)
    process.env.DEMO_BUDGET_AI_USD = '-1'
    expect(budgets().aiUsd).toBe(25)
  })

  it('accepts a deliberate zero', () => {
    process.env.DEMO_BUDGET_SPEECH_CHARS = '0'
    expect(budgets().speechChars).toBe(0)
  })
})

describe('perUserKey', () => {
  it('namespaces one visitor away from another', () => {
    expect(perUserKey('abc')).toBe('anthropic:calls:abc')
    expect(perUserKey('abc')).not.toBe(perUserKey('abd'))
  })
})
