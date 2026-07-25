import { describe, expect, it } from 'vitest'
import {
  applyCorrections,
  normaliseCorrection,
  parseUkDate,
  transcriptExcerpt,
  whenLabel,
} from './read'

describe('parseUkDate', () => {
  it('reads the day before the month, the way the letters are written', () => {
    expect(parseUkDate('05/12/2026')).toBe('2026-12-05')
    expect(parseUkDate('12/05/2026')).toBe('2026-05-12')
  })

  it('accepts the shapes a person actually types', () => {
    expect(parseUkDate('2026-05-12')).toBe('2026-05-12')
    expect(parseUkDate('12-5-2026')).toBe('2026-05-12')
    expect(parseUkDate('12 May 2026')).toBe('2026-05-12')
    expect(parseUkDate('1 January 2026')).toBe('2026-01-01')
  })

  it('refuses a date that does not exist rather than rolling it forward', () => {
    expect(parseUkDate('31/02/2026')).toBeNull()
    expect(parseUkDate('sometime in May')).toBeNull()
  })
})

describe('normaliseCorrection', () => {
  it('turns a typed date into the shape the story sorts by', () => {
    expect(normaliseCorrection('open_loops', 'expected_date', '23/06/2026')).toBe('2026-06-23')
  })

  it('refuses a state the app has no card for, and accepts one it has', () => {
    expect(normaliseCorrection('open_loops', 'state', 'Done')).toBe('done')
    expect(normaliseCorrection('open_loops', 'state', 'chased twice')).toBeNull()
  })

  it('keeps an appointment time when one is given', () => {
    expect(normaliseCorrection('appointments', 'starts_at', '14/07/2026 10:20')).toBe(
      '2026-07-14T10:20'
    )
    expect(normaliseCorrection('appointments', 'starts_at', '14/07/2026')).toBe('2026-07-14')
  })

  it('takes a reading as a number and nothing else', () => {
    expect(normaliseCorrection('results', 'value', ' 46 ')).toBe('46')
    expect(normaliseCorrection('results', 'value', '46 mL/min')).toBeNull()
  })

  it('leaves free text alone', () => {
    expect(normaliseCorrection('medications', 'current_dose', '5mg once daily')).toBe(
      '5mg once daily'
    )
  })
})

describe('applyCorrections', () => {
  it('overlays the human value without touching the machine row', () => {
    const row = { id: 'a', current_dose: '2.5mg', name: 'Ramipril' }
    const fixed = applyCorrections(row, { current_dose: '5mg' })
    expect(fixed.current_dose).toBe('5mg')
    expect(row.current_dose).toBe('2.5mg')
  })

  it('ignores a correction for a column this row does not have', () => {
    const row = { id: 'a', name: 'Ramipril' }
    expect(applyCorrections(row, { gone: 'x' })).toEqual(row)
  })
})

describe('whenLabel', () => {
  it('reads a hand-typed time literally, with no timezone drift', () => {
    expect(whenLabel('2026-07-14T10:20')).toBe('14 Jul, 10:20')
    expect(whenLabel('2026-07-14')).toBe('14 Jul')
  })
})

describe('transcriptExcerpt', () => {
  const letter = `Dear Dr Raman

Re: Mr Samuel Adeyemi, DOB 14 March 1952

${'Filler about the clinic and the waiting room. '.repeat(12)}
I have increased his Ramipril to 5 mg once daily and will repeat his bloods.
${'Closing paragraph that runs on for a while. '.repeat(12)}`

  it('finds the record’s "5mg" in the letter’s "5 mg", and centres on it', () => {
    const found = transcriptExcerpt(letter, ['5mg'])
    expect(found.located).toBe(true)
    expect(found.text).toContain('Ramipril')
  })

  it('does not mistake 15mg for 5mg', () => {
    expect(transcriptExcerpt('Take 15mg at night.', ['5mg']).located).toBe(false)
  })

  it('never claims the top of the letter is the line a value came from', () => {
    const missed = transcriptExcerpt(letter, ['Bisoprolol 2.5mg'])
    expect(missed.located).toBe(false)
    expect(missed.text.startsWith('Dear Dr Raman')).toBe(true)
  })
})
