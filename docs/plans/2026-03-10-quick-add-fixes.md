# Quick-Add Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix project selector dropdown being hidden behind the sheet, and replace the single receipt upload button with two prominent Camera / File buttons.

**Architecture:** Two isolated changes — bump `z-50` to `z-[70]` on the Select positioner (one line in the shared UI component), and rewrite `ReceiptUpload` to render two large side-by-side buttons with separate `<input>` elements.

**Tech Stack:** Next.js App Router, Tailwind CSS, Base UI Select primitive, `lucide-react` icons, existing `browser-image-compression` + Supabase Storage pipeline.

---

### Task 1: Fix Select dropdown z-index

**Files:**
- Modify: `src/components/ui/select.tsx:81`

**Context:**
- `SelectPrimitive.Positioner` renders in a portal at the body root with `className="isolate z-50"`.
- The QuickAddSheet backdrop and panel are both at `z-[60]`, so the dropdown appears behind them.
- Fix: raise the positioner to `z-[70]`. This is a global change and is safe — nothing else in the app uses a stacking context above `z-[60]`.

**Step 1: Update the z-index**

In `src/components/ui/select.tsx`, on line 81, change:
```
className="isolate z-50"
```
to:
```
className="isolate z-[70]"
```

**Step 2: Run tests**

```bash
cd /srv/projects/work/pai && npm test -- --run
```

Expected: 38 passing.

**Step 3: Commit**

```bash
git add src/components/ui/select.tsx
git commit -m "fix: raise Select positioner z-index above sheet overlay"
```

---

### Task 2: Two-button receipt upload (Camera + File)

**Files:**
- Modify: `src/components/expenses/receipt-upload.tsx`

**Context:**
- The current component has one outline button that opens a generic file picker.
- Replace it with two large side-by-side buttons:
  - **Camera** — `<input accept="image/*" capture="environment">` — opens device camera on mobile
  - **File** — `<input accept="image/*,application/pdf">` — opens file picker
- Both wire to the same existing `handleFile` function.
- While processing, both buttons show a spinner and are disabled.
- Buttons are black-filled to be visually prominent at the top of the sheet.

**Step 1: Rewrite `src/components/expenses/receipt-upload.tsx`**

```typescript
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
  const [loading, setLoading] = useState(false)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
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
      setLoading(false)
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
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {/* Camera button */}
      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        disabled={loading}
        className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl bg-black text-white disabled:opacity-50 active:scale-95 transition-transform"
      >
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <Camera className="h-7 w-7" />
        )}
        <span className="text-sm font-medium">{loading ? 'Processing…' : 'Take Photo'}</span>
      </button>

      {/* File button */}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="flex flex-col items-center justify-center gap-2 h-24 rounded-xl bg-black text-white disabled:opacity-50 active:scale-95 transition-transform"
      >
        {loading ? (
          <Loader2 className="h-7 w-7 animate-spin" />
        ) : (
          <Paperclip className="h-7 w-7" />
        )}
        <span className="text-sm font-medium">{loading ? 'Processing…' : 'Upload File'}</span>
      </button>
    </div>
  )
}
```

**Step 2: Run tests**

```bash
npm test -- --run
```

Expected: 38 passing.

**Step 3: Commit**

```bash
git add src/components/expenses/receipt-upload.tsx
git commit -m "feat: replace receipt upload button with Camera and File buttons"
```

---

### Task 3: Push and deploy

**Step 1: Push to origin**

```bash
git push origin feature/quick-add-expense
```
