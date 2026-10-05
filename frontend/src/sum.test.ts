import { describe, it, expect } from 'vitest'
import { sum } from './sum'

describe('sum', () => {
  it('2 + 3 bằng 5', () => {
    expect(sum(2, 3)).toBe(5)
  })
})