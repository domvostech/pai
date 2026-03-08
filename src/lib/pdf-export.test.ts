import { describe, it, expect } from 'vitest'
import { formatCurrency, buildExpenseRows } from './pdf-export'

describe('formatCurrency', () => {
  it('formats positive amounts with euro sign', () => {
    expect(formatCurrency(42.5)).toBe('€42.50')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('€0.00')
  })

  it('formats negative amounts with leading minus', () => {
    expect(formatCurrency(-15)).toBe('-€15.00')
  })
})

describe('buildExpenseRows', () => {
  it('separates general and transport expenses', () => {
    const expenses = [
      { category: 'general', amount: 100, is_return: false, vendor: 'IKEA', date: '2026-03-01', notes: null, id: '1', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '' },
      { category: 'transport', amount: 20, is_return: false, vendor: 'Uber', date: '2026-03-02', notes: null, id: '2', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '' },
    ]
    const { general, transport } = buildExpenseRows(expenses as any)
    expect(general).toHaveLength(1)
    expect(transport).toHaveLength(1)
    expect(general[0].vendor).toBe('IKEA')
    expect(transport[0].vendor).toBe('Uber')
  })

  it('sorts rows by date ascending', () => {
    const expenses = [
      { category: 'general', amount: 10, is_return: false, vendor: 'B', date: '2026-03-05', notes: null, id: '1', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '' },
      { category: 'general', amount: 20, is_return: false, vendor: 'A', date: '2026-03-01', notes: null, id: '2', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '' },
    ]
    const { general } = buildExpenseRows(expenses as any)
    expect(general[0].vendor).toBe('A')
    expect(general[1].vendor).toBe('B')
  })

  it('includes returns in their category', () => {
    const expenses = [
      { category: 'general', amount: 50, is_return: true, vendor: 'IKEA Return', date: '2026-03-10', notes: null, id: '1', user_id: 'u', project_id: 'p', receipt_path: null, ocr_confidence: null, created_at: '' },
    ]
    const { general } = buildExpenseRows(expenses as any)
    expect(general).toHaveLength(1)
    expect(general[0].is_return).toBe(true)
  })
})
