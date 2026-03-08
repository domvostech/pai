import { describe, it, expect } from 'vitest'
import { extractTokenFromEmail, hasUsableContent } from './email-parser'

describe('extractTokenFromEmail', () => {
  it('extracts token from matching To address', () => {
    const token = extractTokenFromEmail('abc123@mail.testapp.com', 'mail.testapp.com')
    expect(token).toBe('abc123')
  })

  it('returns null for non-matching domain', () => {
    const token = extractTokenFromEmail('someone@gmail.com', 'mail.testapp.com')
    expect(token).toBeNull()
  })

  it('returns null for empty string', () => {
    const token = extractTokenFromEmail('', 'mail.testapp.com')
    expect(token).toBeNull()
  })

  it('is case-insensitive for the local part', () => {
    const token = extractTokenFromEmail('ABC123@mail.testapp.com', 'mail.testapp.com')
    expect(token).toBe('abc123')
  })
})

describe('hasUsableContent', () => {
  it('returns true when image attachments present', () => {
    expect(hasUsableContent({ attachments: [{ ContentType: 'image/jpeg' }], textBody: '' })).toBe(true)
  })

  it('returns true when PDF attachment present', () => {
    expect(hasUsableContent({ attachments: [{ ContentType: 'application/pdf' }], textBody: '' })).toBe(true)
  })

  it('returns true when text body has substantial content', () => {
    expect(hasUsableContent({ attachments: [], textBody: 'Receipt from IKEA total $42.50 paid on 2026-03-08' })).toBe(true)
  })

  it('returns false when no attachments and empty text', () => {
    expect(hasUsableContent({ attachments: [], textBody: '' })).toBe(false)
  })

  it('returns false when text body is too short', () => {
    expect(hasUsableContent({ attachments: [], textBody: 'Hi' })).toBe(false)
  })

  it('ignores non-image/pdf attachments', () => {
    expect(hasUsableContent({ attachments: [{ ContentType: 'text/plain' }], textBody: '' })).toBe(false)
  })
})
