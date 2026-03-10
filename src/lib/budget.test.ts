import { describe, it, expect } from 'vitest'
import { calculateBudgetSummary } from './budget'

describe('calculateBudgetSummary', () => {
  it('calculates spent by category', () => {
    const expenses = [
      { amount_net: 100, category: 'general', is_return: false },
      { amount_net: 50, category: 'transport', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.spentGeneral).toBe(100)
    expect(result.spentTransport).toBe(50)
  })

  it('subtracts returns from totals', () => {
    const expenses = [
      { amount_net: 100, category: 'general', is_return: false },
      { amount_net: 30, category: 'general', is_return: true },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.spentGeneral).toBe(70)
    expect(result.totalSpent).toBe(70)
  })

  it('calculates remaining budget', () => {
    const expenses = [
      { amount_net: 200, category: 'general', is_return: false },
      { amount_net: 100, category: 'transport', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.remaining).toBe(700)
    expect(result.isOverBudget).toBe(false)
  })

  it('flags overbudget correctly', () => {
    const expenses = [
      { amount_net: 1200, category: 'general', is_return: false },
    ]
    const result = calculateBudgetSummary(1000, expenses as any)
    expect(result.isOverBudget).toBe(true)
    expect(result.remaining).toBe(-200)
  })

  it('handles empty expenses', () => {
    const result = calculateBudgetSummary(500, [])
    expect(result.totalSpent).toBe(0)
    expect(result.remaining).toBe(500)
  })
})
