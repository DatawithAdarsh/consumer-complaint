import { describe, it, expect } from 'vitest'
import { computeScore, scoreBand, resolvedPct, isRanked } from './format.js'

describe('computeScore', () => {
  it('gives a neutral-ish score with no data', () => {
    // prior: 50% resolved, severity 3 -> 100 * 0.5 * 0.75 = 37.5
    expect(computeScore({ total: 0, resolved: 0, sumSeverity: 0 })).toBe(37.5)
  })
  it('rewards resolved, low-severity complaints', () => {
    const good = computeScore({ total: 20, resolved: 20, sumSeverity: 20 })
    const bad = computeScore({ total: 20, resolved: 0, sumSeverity: 100 })
    expect(good).toBeGreaterThan(80)
    expect(bad).toBeLessThan(10)
    expect(good).toBeGreaterThan(bad)
  })
  it('does not let one complaint swing the score to an extreme', () => {
    const one = computeScore({ total: 1, resolved: 0, sumSeverity: 5 })
    expect(one).toBeGreaterThan(10)
  })
})

describe('helpers', () => {
  it('bands scores', () => {
    expect(scoreBand(75).tone).toBe('good')
    expect(scoreBand(50).tone).toBe('mid')
    expect(scoreBand(10).tone).toBe('bad')
    expect(scoreBand(null).label).toBe('No data')
  })
  it('formats resolved percentage', () => {
    expect(resolvedPct(1, 4)).toBe('25%')
    expect(resolvedPct(0, 0)).toBe('–')
  })
  it('only ranks companies with enough complaints', () => {
    expect(isRanked({ total_complaints: 2, rank_in_category: null })).toBe(false)
    expect(isRanked({ total_complaints: 3, rank_in_category: 1 })).toBe(true)
  })
})
