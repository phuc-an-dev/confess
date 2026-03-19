import { describe, it, expect } from 'vitest'
import {
  pickRandomQuestion,
  isPoolExhausted,
  advanceTurn,
  getNextHost,
} from '../../src/lib/gameLogic.js'

describe('pickRandomQuestion', () => {
  it('returns only from unused questions', () => {
    const questions = [
      { id: '1', used: false },
      { id: '2', used: true },
      { id: '3', used: false },
    ]
    const result = pickRandomQuestion(questions)
    expect(['1', '3']).toContain(result.id)
  })

  it('returns null when all used', () => {
    expect(pickRandomQuestion([{ id: '1', used: true }])).toBeNull()
  })

  it('returns null for empty array', () => {
    expect(pickRandomQuestion([])).toBeNull()
  })
})

describe('isPoolExhausted', () => {
  it('true when all questions used', () => {
    expect(isPoolExhausted([{ used: true }, { used: true }])).toBe(true)
  })

  it('false when at least one unused', () => {
    expect(isPoolExhausted([{ used: true }, { used: false }])).toBe(false)
  })

  it('true for empty pool', () => {
    expect(isPoolExhausted([])).toBe(true)
  })
})

describe('advanceTurn', () => {
  it('increments index by 1', () => {
    expect(advanceTurn(0)).toBe(1)
    expect(advanceTurn(3)).toBe(4)
  })
})

describe('getNextHost', () => {
  it('returns next player sessionToken', () => {
    const players = [
      { sessionToken: 's1' },
      { sessionToken: 's2' },
      { sessionToken: 's3' },
    ]
    expect(getNextHost('s1', players)).toBe('s2')
  })

  it('wraps to first if current host is last', () => {
    const players = [{ sessionToken: 's1' }, { sessionToken: 's2' }]
    expect(getNextHost('s2', players)).toBe('s1')
  })

  it('returns null if only one player', () => {
    expect(getNextHost('s1', [{ sessionToken: 's1' }])).toBeNull()
  })
})
