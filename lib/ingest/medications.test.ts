import { describe, expect, it } from 'vitest'
import { doseChanged, doseStrength, medKey, richerDose, sameMedicine } from './medications'

describe('medKey', () => {
  it('strips strengths, forms and frequencies', () => {
    expect(medKey('Ramipril 5mg once daily')).toBe('ramipril')
    expect(medKey('Metformin 1 g twice daily')).toBe('metformin')
    expect(medKey('Atorvastatin 20mg film-coated tablets')).toBe('atorvastatin')
  })

  it('collapses the many ways a GTN patch is written', () => {
    const forms = [
      'Glyceryl trinitrate (GTN)',
      'Glyceryl trinitrate (GTN) patch 5mg / 24 hours',
      'Glyceryl trinitrate patch',
      'GLYCERYL TRINITRATE 5 mg patches',
    ]
    const keys = forms.map(medKey)
    for (const k of keys) expect(sameMedicine(forms[0], k)).toBe(true)
  })

  it('keeps genuinely different medicines apart', () => {
    expect(sameMedicine('Ramipril 5mg', 'Bisoprolol 5mg')).toBe(false)
    expect(sameMedicine('Furosemide 40mg', 'Metformin 1g')).toBe(false)
  })
})

describe('doseStrength', () => {
  it('normalises number and unit', () => {
    expect(doseStrength('5mg once daily')).toBe('5mg')
    expect(doseStrength('2.5 mg once daily')).toBe('2.5mg')
    expect(doseStrength('1 g twice daily')).toBe('1g')
    expect(doseStrength('5 mg / 24 hours')).toBe('5mg')
    expect(doseStrength('500 micrograms')).toBe('500mcg')
  })

  it('takes the prescribed strength, not a parenthetical breakdown', () => {
    expect(doseStrength('80mg each morning (2 x 40mg) on some days')).toBe('80mg')
  })

  it('returns null when no strength is stated', () => {
    expect(doseStrength('as directed')).toBeNull()
    expect(doseStrength('')).toBeNull()
    expect(doseStrength(null)).toBeNull()
  })
})

describe('doseChanged', () => {
  it('is false for a restatement in different words', () => {
    // The bug this exists to prevent: a pharmacy slip restating the repeat list
    // must not read as five dose changes and fire five what-changed alerts.
    expect(doseChanged('5mg once daily', '5mg')).toBe(false)
    expect(doseChanged('1g twice daily', '1g')).toBe(false)
    expect(doseChanged('40mg once daily', '40mg')).toBe(false)
    expect(doseChanged('2.5mg once daily', '2.5 mg')).toBe(false)
  })

  it('is true when the strength really moves', () => {
    expect(doseChanged('2.5mg once daily', '5mg once daily')).toBe(true)
    expect(doseChanged('40mg', '80mg each morning (2 x 40mg) on some days')).toBe(true)
  })

  it('falls back to text when a strength is unparseable', () => {
    expect(doseChanged('as directed', 'as directed')).toBe(false)
    expect(doseChanged('as directed', 'one at night')).toBe(true)
  })
})

describe('richerDose', () => {
  it('keeps the more informative wording when nothing changed', () => {
    expect(richerDose('5mg once daily', '5mg')).toBe('5mg once daily')
    expect(richerDose('5mg', '5mg once daily')).toBe('5mg once daily')
  })

  it('takes the new wording when the dose genuinely changed', () => {
    expect(richerDose('2.5mg once daily', '5mg')).toBe('5mg')
  })
})
