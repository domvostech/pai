import type { Database } from './supabase/types'

type Expense = Pick<Database['public']['Tables']['expenses']['Row'], 'amount_net' | 'category' | 'is_return'>

export interface BudgetSummary {
  totalBudget: number
  spentGeneral: number
  spentTransport: number
  totalSpent: number
  remaining: number
  isOverBudget: boolean
}

export function calculateBudgetSummary(totalBudget: number, expenses: Expense[]): BudgetSummary {
  let spentGeneral = 0
  let spentTransport = 0

  for (const expense of expenses) {
    const amount = expense.is_return ? -Math.abs(expense.amount_net) : Math.abs(expense.amount_net)
    if (expense.category === 'general') spentGeneral += amount
    else if (expense.category === 'transport') spentTransport += amount
  }

  const totalSpent = spentGeneral + spentTransport
  const remaining = totalBudget - totalSpent

  return {
    totalBudget,
    spentGeneral,
    spentTransport,
    totalSpent,
    remaining,
    isOverBudget: remaining < 0,
  }
}
