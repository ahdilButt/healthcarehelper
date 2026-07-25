import { describe, expect, it } from 'vitest'
import { defaultTimes } from './schedule'
import { nextSite } from './today'
import { humanTime, isValidTime, londonClock, londonDate, londonInstant, partOfDay } from './time'

describe('londonInstant', () => {
  it('keeps 8am at 8am through the clock change', () => {
    // Winter: London is UTC. Summer: London is UTC+1. The wall clock does not
    // move, so the instant behind it must.
    expect(londonInstant('2026-01-15', '08:00').toISOString()).toBe('2026-01-15T08:00:00.000Z')
    expect(londonInstant('2026-07-15', '08:00').toISOString()).toBe('2026-07-15T07:00:00.000Z')
  })

  it('survives the spring-forward morning', () => {
    // The clocks go forward at 01:00 on 29 March 2026.
    expect(londonInstant('2026-03-29', '08:00').toISOString()).toBe('2026-03-29T07:00:00.000Z')
    expect(londonInstant('2026-03-28', '08:00').toISOString()).toBe('2026-03-28T08:00:00.000Z')
  })

  it('round-trips back to the same wall clock', () => {
    for (const date of ['2026-01-15', '2026-06-01', '2026-10-25', '2026-12-31']) {
      for (const time of ['00:00', '08:00', '13:00', '21:30']) {
        expect(londonClock(londonInstant(date, time))).toBe(time)
        expect(londonDate(londonInstant(date, time))).toBe(date)
      }
    }
  })
})

describe('partOfDay', () => {
  it('splits the day the way the screen does', () => {
    expect(partOfDay('08:00')).toBe('morning')
    expect(partOfDay('11:59')).toBe('morning')
    expect(partOfDay('13:00')).toBe('afternoon')
    expect(partOfDay('18:00')).toBe('evening')
    expect(partOfDay('21:30')).toBe('evening')
  })
})

describe('humanTime', () => {
  it('reads like a phone, not like a timetable', () => {
    expect(humanTime('08:00')).toBe('8am')
    expect(humanTime('13:00')).toBe('1pm')
    expect(humanTime('21:30')).toBe('9:30pm')
    expect(humanTime('00:00')).toBe('12am')
    expect(humanTime('12:00')).toBe('12pm')
  })
})

describe('isValidTime', () => {
  it('takes 24-hour times only', () => {
    expect(isValidTime('08:00')).toBe(true)
    expect(isValidTime('23:59')).toBe(true)
    expect(isValidTime('24:00')).toBe(false)
    expect(isValidTime('8:00')).toBe(false)
    expect(isValidTime('breakfast')).toBe(false)
  })
})

describe('defaultTimes', () => {
  const med = (current_dose: string, schedule_hint: string | null = null, form = 'tablet') =>
    ({ current_dose, schedule_hint, form }) as Parameters<typeof defaultTimes>[0]

  it('reads the prescriber’s own shorthand', () => {
    expect(defaultTimes(med('1g twice daily'))).toEqual(['08:00', '20:00'])
    expect(defaultTimes(med('500mg', 'one tablet bd'))).toEqual(['08:00', '20:00'])
    expect(defaultTimes(med('20mg once daily at night'))).toEqual(['21:30'])
    expect(defaultTimes(med('10mg', 'three times a day'))).toEqual(['08:00', '13:00', '20:00'])
  })

  it('gives Dad’s actual medicines a sensible round', () => {
    expect(defaultTimes(med('5mg once daily', 'One tablet once daily'))).toEqual(['08:00'])
    expect(defaultTimes(med('40mg once daily', 'in the morning'))).toEqual(['08:00'])
    expect(defaultTimes(med('1g twice daily', 'One tablet twice daily, with food'))).toEqual([
      '08:00',
      '20:00',
    ])
    expect(defaultTimes(med('20mg once daily', 'take one tablet each night'))).toEqual(['21:30'])
  })

  it('puts a patch on in the morning however the letter phrases the night', () => {
    // The real hint says "one patch each morning and off at night" — the night
    // half is when it comes off, not when it goes on.
    expect(
      defaultTimes(med('5mg / 24 hours', 'One patch each morning and off at night', 'patch'))
    ).toEqual(['08:00'])
  })
})

describe('nextSite', () => {
  const sites = ['left hip', 'right hip', 'left upper arm', 'right upper arm']

  it('goes round the body in order', () => {
    expect(nextSite(sites, null)).toBe('left hip')
    expect(nextSite(sites, 'left hip')).toBe('right hip')
    expect(nextSite(sites, 'right upper arm')).toBe('left hip')
  })

  it('starts over when the last site is no longer offered', () => {
    expect(nextSite(sites, 'left thigh')).toBe('left hip')
    expect(nextSite([], 'left hip')).toBeNull()
  })
})
