import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { extractReceiptData } from '@/lib/ocr'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const text = formData.get('text') as string | null

  try {
    if (file && file.size > 0) {
      const buffer = await file.arrayBuffer()
      const base64 = Buffer.from(buffer).toString('base64')
      const result = await extractReceiptData({ imageBase64: base64, mimeType: file.type })
      return NextResponse.json(result)
    } else if (text && text.trim().length > 0) {
      const result = await extractReceiptData({ text })
      return NextResponse.json(result)
    }
    return NextResponse.json({ error: 'No file or text provided' }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'OCR failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
