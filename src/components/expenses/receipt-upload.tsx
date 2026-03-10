'use client'
import { useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { createClient } from '@/lib/supabase/client'
import { IMAGE_COMPRESSION_OPTIONS, shouldCompressAsImage, getReceiptStoragePath } from '@/lib/receipt-compression'
import type { OcrResult } from '@/lib/ocr'
import { Camera, Paperclip, Loader2 } from 'lucide-react'

interface Props {
  userId: string
  onResult: (result: { storagePath: string; ocrResult: OcrResult }) => void
  onError: (msg: string) => void
}

export default function ReceiptUpload({ userId, onResult, onError }: Props) {
  const [loading, setLoading] = useState<'camera' | 'file' | null>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File, source: 'camera' | 'file') {
    setLoading(source)
    try {
      const expenseId = crypto.randomUUID()
      const isPdf = file.type === 'application/pdf'
      const ext = isPdf ? 'pdf' : 'jpeg'
      const storagePath = getReceiptStoragePath(userId, expenseId, ext)

      let uploadFile: File = file
      if (shouldCompressAsImage(file.type)) {
        uploadFile = await imageCompression(file, IMAGE_COMPRESSION_OPTIONS)
      }

      const supabase = createClient()
      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(storagePath, uploadFile, { contentType: isPdf ? 'application/pdf' : 'image/jpeg' })
      if (uploadError) throw new Error(uploadError.message)

      const formData = new FormData()
      formData.append('file', uploadFile)
      const ocrRes = await fetch('/api/ocr', { method: 'POST', body: formData })
      if (!ocrRes.ok) throw new Error('OCR failed')
      const ocrResult: OcrResult = await ocrRes.json()

      onResult({ storagePath, ocrResult })
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setLoading(null)
      if (cameraRef.current) cameraRef.current.value = ''
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Hidden inputs */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'camera')}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0], 'file')}
      />

      {/* Camera button */}
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        disabled={loading !== null}
        className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl bg-black text-white disabled:opacity-50 active:scale-95 transition-transform"
      >
        {loading === 'camera' ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <Camera className="h-7 w-7" />
        )}
        <span className="text-sm font-medium">
          {loading === 'camera' ? 'Processing…' : 'Take Photo'}
        </span>
      </button>

      {/* File button */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={loading !== null}
        className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl bg-black text-white disabled:opacity-50 active:scale-95 transition-transform"
      >
        {loading === 'file' ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <Paperclip className="h-7 w-7" />
        )}
        <span className="text-sm font-medium">
          {loading === 'file' ? 'Processing…' : 'Upload File'}
        </span>
      </button>
    </div>
  )
}
