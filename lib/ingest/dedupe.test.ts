import { describe, expect, it } from 'vitest'
import { NEAR_IDENTICAL, textSimilarity } from './dedupe'

/**
 * Doc 12b is a photograph of doc 08 taken at an angle in different light, so
 * its transcript will never be byte-identical — but it must still be caught.
 */
const LETTER = `St Saviour's NHS Foundation Trust
Department of Cardiology
Re: Mr Samuel Adeyemi
Date of birth: 14 March 1952    NHS number: 999 471 3382
Dear Dr Raman
Thank you for your continuing care of Mr Adeyemi, whom I reviewed in the cardiology
outpatient clinic here at St Saviour's on 12 May 2026. I have increased his Ramipril
from 2.5 mg to 5 mg once daily. His renal function has declined a little.`

// The same page, re-photographed: a few words lost to shadow, one misread.
const REPHOTOGRAPHED = `St Saviour's NHS Foundation Trust
Department of Cardiology
Re: Mr Samuel Adeyemi
Date of birth: 14 March 1952    NHS number: 999 471 3382
Dear Dr Raman
Thank you for your continuing care of Mr Adeyemi, whom I reviewed in the cardiology
outpatient clinic here at St Saviours on 12 May 2026. I have increased his Ramipril
from 2.5 mg to 5 mg once daily. His renal function has declined a Iittle.`

const DIFFERENT_LETTER = `Marlow Fields Medical Centre
Re: Mr Samuel Adeyemi
Dear Mr Adeyemi
We reviewed your medicines today. Your blood pressure today was 152/88. We have
started a glyceryl trinitrate patch, one patch each morning, rotating the site
between your hips and upper arms. You remain allergic to penicillin.`

describe('textSimilarity', () => {
  it('catches the same letter photographed twice', () => {
    const sim = textSimilarity(LETTER, REPHOTOGRAPHED)
    expect(sim).toBeGreaterThanOrEqual(NEAR_IDENTICAL)
  })

  it('does not confuse two different letters about the same patient', () => {
    const sim = textSimilarity(LETTER, DIFFERENT_LETTER)
    expect(sim).toBeLessThan(NEAR_IDENTICAL)
  })

  it('is symmetric and bounded', () => {
    expect(textSimilarity(LETTER, LETTER)).toBe(1)
    expect(textSimilarity(LETTER, DIFFERENT_LETTER)).toBe(
      textSimilarity(DIFFERENT_LETTER, LETTER)
    )
    expect(textSimilarity('', LETTER)).toBe(0)
  })
})
