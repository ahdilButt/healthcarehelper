import { describe, expect, it } from 'vitest'
import { doseChanged, doseStrength, medKey, richerDose, sameMedicine, statesADose } from './medications'

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

/**
 * Found by the M3 unplug: the live ingest turned Metformin's "1 g twice daily"
 * into "Dose not stated" and then into "1g tablets", inventing two dose
 * changes on the way. A letter can name a medicine without prescribing one.
 */
describe('a mention is not a dose', () => {
  it('knows which strings state a dose', () => {
    expect(statesADose('1 g twice daily')).toBe(true)
    expect(statesADose('5mg')).toBe(true)
    expect(statesADose('one tablet daily')).toBe(true)
    expect(statesADose('Dose not stated')).toBe(false)
    expect(statesADose('not specified')).toBe(false)
    expect(statesADose('unchanged')).toBe(false)
    expect(statesADose('as before')).toBe(false)
    expect(statesADose('continue')).toBe(false)
    expect(statesADose('')).toBe(false)
    expect(statesADose(null)).toBe(false)
  })

  it('never reads a mention as a change', () => {
    expect(doseChanged('1 g twice daily', 'Dose not stated')).toBe(false)
    expect(doseChanged('1 g twice daily', 'unchanged')).toBe(false)
    expect(doseChanged('Dose not stated', '1g twice daily')).toBe(true)
    expect(doseChanged('2.5mg once daily', '5mg once daily')).toBe(true)
  })

  it('never lets a mention overwrite a prescription', () => {
    expect(richerDose('1 g twice daily', 'Dose not stated')).toBe('1 g twice daily')
    expect(richerDose('Dose not stated', '1 g twice daily')).toBe('1 g twice daily')
    expect(richerDose('5mg', '5mg once daily')).toBe('5mg once daily')
  })
})

/**
 * Also from the M3 unplug: the pharmacy repeat slip is ingested last, and its
 * wording is longer than a clinic letter's while saying less about when to
 * take anything. Every dose on the record ended up reading "quantity 28".
 */
describe('the wording that survives', () => {
  it('prefers when-to-take-it over how-many-were-dispensed', () => {
    expect(richerDose('5mg once daily', '5mg tablets, quantity 28')).toBe('5mg once daily')
    expect(richerDose('1 g twice daily', '1g tablets, quantity 56')).toBe('1 g twice daily')
    expect(richerDose('40mg once daily in the morning', '40mg tablets, quantity 28')).toBe(
      '40mg once daily in the morning'
    )
  })

  it('still lets a fuller clinical wording win', () => {
    expect(richerDose('5mg', '5mg once daily')).toBe('5mg once daily')
  })

  it('reads "unchanged - dose not stated" as no dose at all', () => {
    expect(statesADose('unchanged - dose not stated')).toBe(false)
    expect(doseChanged('1 g twice daily', 'unchanged - dose not stated')).toBe(false)
    expect(richerDose('1 g twice daily', 'unchanged - dose not stated')).toBe('1 g twice daily')
  })
})
