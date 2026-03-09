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

  // Markdown stripping — LLMs like Gemini often wrap JSON in code fences
  it('strips ```json code fences from model response', () => {
    const raw = '```json\n{"vendor":"Rossmann","amount":13.00,"date":"2025-06-27","category":"general","notes":null,"confidence":{"vendor":0.95,"amount":0.99,"date":0.95,"category":0.85}}\n```'
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Rossmann')
    expect(result.amount).toBe(13.00)
    expect(result.date).toBe('2025-06-27')
  })

  it('strips plain ``` code fences from model response', () => {
    const raw = '```\n{"vendor":"Kopiefrosch","amount":45.00,"date":"2025-06-30","category":"general","notes":"Printing copies","confidence":{"vendor":0.95,"amount":0.99,"date":0.95,"category":0.85}}\n```'
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Kopiefrosch')
    expect(result.amount).toBe(45.00)
    expect(result.date).toBe('2025-06-30')
  })

  // Real-world receipt data from Stereo Films / Aktion Mensch project
  it('parses Rossmann Fotowelt receipt (photo printing, €13.00, 27 Jun 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'Rossmann Fotowelt',
      amount: 13.00,
      date: '2025-06-27',
      category: 'general',
      notes: 'Photo printing',
      confidence: { vendor: 0.95, amount: 0.99, date: 0.95, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Rossmann Fotowelt')
    expect(result.amount).toBe(13.00)
    expect(result.date).toBe('2025-06-27')
    expect(result.category).toBe('general')
  })

  it('parses IKEA receipt (lighting props, €562.88, 1 Jul 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'IKEA',
      amount: 562.88,
      date: '2025-07-01',
      category: 'general',
      notes: 'Lighting fixtures and props',
      confidence: { vendor: 0.99, amount: 0.99, date: 0.99, category: 0.90 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('IKEA')
    expect(result.amount).toBe(562.88)
    expect(result.date).toBe('2025-07-01')
    expect(result.category).toBe('general')
  })

  it('parses Shell fuel receipt as transport category', () => {
    const raw = JSON.stringify({
      vendor: 'Shell',
      amount: 225.00,
      date: '2025-07-15',
      category: 'transport',
      notes: 'Fuel',
      confidence: { vendor: 0.99, amount: 0.95, date: 0.90, category: 0.99 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Shell')
    expect(result.amount).toBe(225.00)
    expect(result.category).toBe('transport')
  })

  it('parses Kopiefrosch copy shop receipt (€45.00, 30 Jun 2025)', () => {
    const raw = JSON.stringify({
      vendor: 'Kopiefrosch',
      amount: 45.00,
      date: '2025-06-30',
      category: 'general',
      notes: 'Printing/copies',
      confidence: { vendor: 0.95, amount: 0.99, date: 0.95, category: 0.85 }
    })
    const result = parseOcrResponse(raw)
    expect(result.vendor).toBe('Kopiefrosch')
    expect(result.amount).toBe(45.00)
    expect(result.date).toBe('2025-06-30')
    expect(result.category).toBe('general')
  })
})
