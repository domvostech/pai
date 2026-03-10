import { describe, it, expect } from 'vitest'
import { parseOcrResponse } from './ocr'

describe('parseOcrResponse', () => {
  it('parses a valid OCR response with net amount only', () => {
    const raw = JSON.stringify({
      vendor: 'IKEA',
      amount_net: 42.50,
      amount_gross: null,
      amount_19: null,
      amount_7: null,
      amount_0: null,
      date: '2026-03-08',
      category: 'general',
      notes: null,
      confidence: { vendor: 0.95, amount_net: 0.99, date: 0.90, category: 0.80 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('IKEA')
    expect(result.amount_net).toBe(42.50)
    expect(result.amount_gross).toBeNull()
    expect(result.date).toBe('2026-03-08')
    expect(result.confidence.vendor).toBe(0.95)
  })

  it('parses a receipt with full VAT breakdown', () => {
    const raw = JSON.stringify({
      vendor: 'Kaufland',
      amount_net: 9.02,
      amount_gross: 9.42,
      amount_19: 6.06,
      amount_7: 3.36,
      amount_0: null,
      date: '2026-01-15',
      category: 'general',
      notes: 'Groceries',
      confidence: { vendor: 0.95, amount_net: 0.99, date: 0.95, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.amount_net).toBe(9.02)
    expect(result.amount_gross).toBe(9.42)
    expect(result.amount_19).toBe(6.06)
    expect(result.amount_7).toBe(3.36)
    expect(result.amount_0).toBeNull()
  })

  it('returns null fields for invalid JSON', () => {
    const result = parseOcrResponse('not json')
    expect(result.vendor).toBeNull()
    expect(result.amount_net).toBeNull()
    expect(result.amount_gross).toBeNull()
  })

  it('identifies low confidence fields (threshold 0.7)', () => {
    const raw = JSON.stringify({
      vendor: 'Shop',
      amount_net: 10,
      amount_gross: null,
      amount_19: null,
      amount_7: null,
      amount_0: null,
      date: '2026-01-01',
      category: 'general',
      notes: null,
      confidence: { vendor: 0.4, amount_net: 0.95, date: 0.9, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.lowConfidenceFields).toContain('vendor')
    expect(result.lowConfidenceFields).not.toContain('amount_net')
  })

  it('returns null category for unknown values', () => {
    const raw = JSON.stringify({
      vendor: 'Shop', amount_net: 10, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2026-01-01', category: 'food', notes: null, confidence: {}
    })
    const result = parseOcrResponse(raw)
    expect(result.category).toBeNull()
  })

  it('returns empty arrays/objects when confidence is missing', () => {
    const raw = JSON.stringify({
      vendor: 'Shop', amount_net: 10, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2026-01-01', category: 'general', notes: null
    })
    const result = parseOcrResponse(raw)
    expect(result.confidence).toEqual({})
    expect(result.lowConfidenceFields).toEqual([])
  })

  it('strips ```json code fences from model response', () => {
    const raw = '```json\n{"vendor":"Rossmann","amount_net":13.00,"amount_gross":null,"amount_19":null,"amount_7":null,"amount_0":null,"date":"2025-06-27","category":"general","notes":null,"confidence":{"vendor":0.95,"amount_net":0.99,"date":0.95,"category":0.85}}\n```'
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Rossmann')
    expect(result.amount_net).toBe(13.00)
    expect(result.date).toBe('2025-06-27')
  })

  it('strips plain ``` code fences from model response', () => {
    const raw = '```\n{"vendor":"Kopiefrosch","amount_net":45.00,"amount_gross":null,"amount_19":null,"amount_7":null,"amount_0":null,"date":"2025-06-30","category":"general","notes":"Printing copies","confidence":{"vendor":0.95,"amount_net":0.99,"date":0.95,"category":0.85}}\n```'
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Kopiefrosch')
    expect(result.amount_net).toBe(45.00)
    expect(result.date).toBe('2025-06-30')
  })

  it('parses Rossmann Fotowelt receipt (photo printing, €13.00, 27 Jun 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'Rossmann Fotowelt', amount_net: 13.00, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2025-06-27', category: 'general', notes: 'Photo printing',
      confidence: { vendor: 0.95, amount_net: 0.99, date: 0.95, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Rossmann Fotowelt')
    expect(result.amount_net).toBe(13.00)
    expect(result.date).toBe('2025-06-27')
    expect(result.category).toBe('general')
  })

  it('parses IKEA receipt (lighting props, €562.88, 1 Jul 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'IKEA', amount_net: 562.88, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2025-07-01', category: 'general', notes: 'Lighting fixtures and props',
      confidence: { vendor: 0.99, amount_net: 0.99, date: 0.99, category: 0.90 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('IKEA')
    expect(result.amount_net).toBe(562.88)
    expect(result.date).toBe('2025-07-01')
    expect(result.category).toBe('general')
  })

  it('parses Shell fuel receipt as transport category', () => {
    const raw = JSON.stringify({
      vendor: 'Shell', amount_net: 225.00, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2025-07-15', category: 'transport', notes: 'Fuel',
      confidence: { vendor: 0.99, amount_net: 0.95, date: 0.90, category: 0.99 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Shell')
    expect(result.amount_net).toBe(225.00)
    expect(result.category).toBe('transport')
  })

  it('parses Kopiefrosch copy shop receipt (€45.00, 30 Jun 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'Kopiefrosch', amount_net: 45.00, amount_gross: null, amount_19: null, amount_7: null, amount_0: null,
      date: '2025-06-30', category: 'general', notes: 'Printing/copies',
      confidence: { vendor: 0.95, amount_net: 0.99, date: 0.95, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Kopiefrosch')
    expect(result.amount_net).toBe(45.00)
    expect(result.date).toBe('2025-06-30')
    expect(result.category).toBe('general')
  })
})
