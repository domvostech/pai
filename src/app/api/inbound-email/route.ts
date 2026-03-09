import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { extractTokenFromEmail, hasUsableContent } from '@/lib/email-parser'
import { extractReceiptData } from '@/lib/ocr'
import { getReceiptStoragePath } from '@/lib/receipt-compression'

const INBOUND_DOMAIN = process.env.INBOUND_EMAIL_DOMAIN ?? 'mail.yourapp.com'

export async function POST(request: Request) {
  // Verify webhook secret via query parameter (Postmark doesn't support custom headers)
  const { searchParams } = new URL(request.url)
  const secret = searchParams.get('secret')
  const expectedSecret = process.env.POSTMARK_WEBHOOK_SECRET ?? ''
  const secretBuffer = Buffer.from(secret ?? '')
  const expectedBuffer = Buffer.from(expectedSecret)
  const secretsMatch = secret !== null &&
    expectedSecret.length > 0 &&
    secretBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(secretBuffer, expectedBuffer)
  if (!secretsMatch) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const supabase = createServiceClient()

  // Extract To address — Postmark sends ToFull array or To string
  const toAddress: string = Array.isArray(body.ToFull)
    ? (body.ToFull[0]?.Email ?? '')
    : (body.To ?? '')
  const fromAddress: string = body.From ?? 'unknown'

  // Find user by inbound token
  const token = extractTokenFromEmail(toAddress, INBOUND_DOMAIN)
  if (!token) return NextResponse.json({ ok: true }) // Not addressed to us

  const { data: tokenRow } = await supabase
    .from('inbound_tokens')
    .select('user_id')
    .eq('token', token)
    .single()

  if (!tokenRow) return NextResponse.json({ ok: true }) // Token not found, ignore silently

  const userId = tokenRow.user_id
  const today = new Date().toISOString().split('T')[0]

  // Parse email content
  const attachments: Array<{ Content: string; ContentType: string; Name: string }> =
    body.Attachments ?? []
  const textBody: string = body.TextBody ?? ''
  const htmlBody: string = body.HtmlBody ?? ''

  const hasContent = hasUsableContent({
    attachments,
    textBody,
    htmlBody,
  })

  if (!hasContent) {
    // No usable content — create a flagged inbox entry
    const { error: insertError1 } = await supabase.from('expenses').insert({
      user_id: userId,
      project_id: null,
      vendor: `No relevant information found (from: ${fromAddress})`,
      amount: 1,
      date: today,
      category: 'general',
      notes: 'Email received but no receipt data could be extracted.',
    })
    if (insertError1) {
      console.error('Failed to create inbox entry:', insertError1.message)
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  // Find first usable attachment
  const usableAttachment = attachments.find(a =>
    ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'].includes(a.ContentType)
  )

  let receiptPath: string | null = null
  let ocrResult = null

  if (usableAttachment) {
    // Upload to storage
    const expenseId = crypto.randomUUID()
    const ext = usableAttachment.ContentType === 'application/pdf' ? 'pdf' : 'jpeg'
    receiptPath = getReceiptStoragePath(userId, expenseId, ext)

    const buffer = Buffer.from(usableAttachment.Content, 'base64')
    await supabase.storage.from('receipts').upload(receiptPath, buffer, {
      contentType: usableAttachment.ContentType,
    })

    // Run OCR on the attachment
    ocrResult = await extractReceiptData({
      imageBase64: usableAttachment.Content,
      mimeType: usableAttachment.ContentType,
    })
  } else {
    // No attachment — try to extract from email body text
    const cleanText = htmlBody
      ? htmlBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : textBody
    ocrResult = await extractReceiptData({ text: cleanText })
  }

  // Insert inbox expense (project_id = null)
  const { error: insertError2 } = await supabase.from('expenses').insert({
    user_id: userId,
    project_id: null,
    vendor: ocrResult?.vendor ?? `Email from ${fromAddress}`,
    amount: ocrResult?.amount ?? 1,
    date: ocrResult?.date ?? today,
    category: ocrResult?.category ?? 'general',
    notes: ocrResult?.notes ?? null,
    receipt_path: receiptPath,
    ocr_confidence: ocrResult?.confidence ?? null,
  })
  if (insertError2) {
    console.error('Failed to create inbox expense:', insertError2.message)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
