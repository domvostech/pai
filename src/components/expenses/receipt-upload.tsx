'use client'
import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { IMAGE_COMPRESSION_OPTIONS, shouldCompressAsImage, getReceiptStoragePath } from '@/lib/receipt-compression'
import type { OcrResult } from '@/lib/ocr'
import { Button } from '@/components/ui/button'
import { Upload, Loader2 } from 'lucide-react'

interface Props {
  userId: string
  onResult: (result: { storagePath: string; ocrResult: OcrResult }) => void
  onError: (msg: string) => void
}

export default function ReceiptUpload({ userId, onResult, onError }: Props) {
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    try {
      const expenseId = crypto.randomUUID()
      const isPdf = file.type === 'application/pdf'
      const ext = isPdf ? 'pdf' : 'jpeg'
      const storagePath = getReceiptStoragePath(userId, expenseId, ext)

      // Compress images client-side; PDFs go as-is
      let uploadFile: File = file
      if (shouldCompressAsImage(file.type)) {
        uploadFile = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS)
      }

      // Upload to Supabase Storage
      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, uploadFile, { contentType: isPdf ? 'application/pdf' : 'image/jpeg' })
      if (uploadError) throw new Error(uploadError.message)

      // Run OCR
      const formData = new FormData()
      formData.append('file', uploadFile)
      const ocrRes = await fetch('/api/ocr', { method: 'POST', body: formData })
      if (!ocrRes.ok) throw new Error('OCR failed')
      const ocrResult: OcrResult = await ocrRes.json()

      onResult({ storagePath, ocrResult })
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        className="w-full"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing receipt…</>
        ) : (
          <><Upload className="h-4 w-4 mr-2" />Upload receipt (photo or PDF)</>
        )}
      </Button>
    </div>
  )
}
