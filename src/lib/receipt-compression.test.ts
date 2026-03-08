import { describe, it, expect } from 'vitest'
import { shouldCompressAsImage, getReceiptStoragePath } from './receipt-compression'

describe('getReceiptStoragePath', () => {
  it('generates path with user id prefix', () => {
    const path = getReceiptStoragePath('user-123', 'expense-456', 'jpg')
    expect(path).toBe('user-123/expense-456.jpg')
  })

  it('lowercases extension', () => {
    const path = getReceiptStoragePath('u1', 'e1', 'JPEG')
    expect(path).toContain('.jpeg')
  })
})

describe('shouldCompressAsImage', () => {
  it('returns true for image/jpeg', () => {
    expect(shouldCompressAsImage('image/jpeg')).toBe(true)
  })

  it('returns true for image/png', () => {
    expect(shouldCompressAsImage('image/png')).toBe(true)
  })

  it('returns false for PDF', () => {
    expect(shouldCompressAsImage('application/pdf')).toBe(false)
  })

  it('returns false for unknown type', () => {
    expect(shouldCompressAsImage('text/plain')).toBe(false)
  })
})
