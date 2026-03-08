import { describe, it, expect } from 'vitest'
import { parseOcrResponse } from './ocr'

describe('parseOcrResponse', () => {
  it('parses a valid OCR response', () => {
    const raw = JSON.stringify({
      vendor: 'IKEA',
      amount: 42.50,
      date: '2026-03-08',
      category: 'general',
      notes: null,
      confidence: { vendor: 0.95, amount: 0.99, date: 0.90, category: 0.80 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('IKEA')
    expect(result.amount).toBe(42.50)
    expect(result.date).toBe('2026-03-08')
    expect(result.confidence.vendor).toBe(0.95)
  })

  it('returns null fields for invalid JSON', () => {
    const result = parseOcrResponse('not json')
    expect(result.vendor).toBeNull()
    expect(result.amount).toBeNull()
  })

  it('identifies low confidence fields (threshold 0.7)', () => {
    const raw = JSON.stringify({
      vendor: 'Shop',
      amount: 10,
      date: '2026-01-01',
      category: 'general',
      notes: null,
      confidence: { vendor: 0.4, amount: 0.95, date: 0.9, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.lowConfidenceFields).toContain('vendor')
    expect(result.lowConfidenceFields).not.toContain('amount')
  })

  it('returns null category for unknown values', () => {
    const raw = JSON.stringify({
      vendor: 'Shop', amount: 10, date: '2026-01-01', category: 'food', notes: null,
      confidence: {}
    })
    const result = parseOcrResponse(raw)
    expect(result.category).toBeNull()
  })

  it('returns empty arrays/objects when confidence is missing', () => {
    const raw = JSON.stringify({ vendor: 'Shop', amount: 10, date: '2026-01-01', category: 'general', notes: null })
    const result = parseOcrResponse(raw)
    expect(result.confidence).toEqual({})
    expect(result.lowConfidenceFields).toEqual([])
  })
})
