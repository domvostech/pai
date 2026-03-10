'use client'
import { useState } from 'react'
import ReceiptUpload from './receipt-upload'
import type { OcrResult } from '@/lib/ocr'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface Props {
  userId: string
  projectId?: string
  onSuccess: () => void
  projects?: Array<{ id: string; name: string }>
}

export default function ExpenseForm({ userId, projectId, onSuccess, projects }: Props) {
  const [vendor, setVendor] = useState('')
  const [amountNet, setAmountNet] = useState('')
  const [amountGross, setAmountGross] = useState('')
  const [amount19, setAmount19] = useState('')
  const [amount7, setAmount7] = useState('')
  const [amount0, setAmount0] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState<'general' | 'transport'>('general')
  const [notes, setNotes] = useState('')
  const [isReturn, setIsReturn] = useState(false)
  const [receiptPath, setReceiptPath] = useState<string | null>(null)
  const [lowConfidence, setLowConfidence] = useState<string[]>([])
  const [ocrConfidence, setOcrConfidence] = useState<Record<string, number>>({})
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projectId ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleOcrResult({ storagePath, ocrResult }: { storagePath: string; ocrResult: OcrResult }) {
    setReceiptPath(storagePath)
    setLowConfidence(ocrResult.lowConfidenceFields)
    setOcrConfidence(ocrResult.confidence)
    if (ocrResult.vendor) setVendor(ocrResult.vendor)
    if (ocrResult.amount_net !== null) setAmountNet(String(ocrResult.amount_net))
    if (ocrResult.amount_gross !== null) setAmountGross(String(ocrResult.amount_gross))
    if (ocrResult.amount_19 !== null) setAmount19(String(ocrResult.amount_19))
    if (ocrResult.amount_7 !== null) setAmount7(String(ocrResult.amount_7))
    if (ocrResult.amount_0 !== null) setAmount0(String(ocrResult.amount_0))
    if (ocrResult.date) setDate(ocrResult.date)
    if (ocrResult.category) setCategory(ocrResult.category)
    if (ocrResult.notes) setNotes(ocrResult.notes)
  }

  function fieldClass(field: string) {
    return cn(lowConfidence.includes(field) && 'ring-2 ring-yellow-400 ring-offset-1')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: selectedProjectId,
        vendor: vendor || null,
        amount_net: parseFloat(amountNet),
        amount_gross: amountGross ? parseFloat(amountGross) : null,
        amount_19: amount19 ? parseFloat(amount19) : null,
        amount_7: amount7 ? parseFloat(amount7) : null,
        amount_0: amount0 ? parseFloat(amount0) : null,
        date,
        category,
        notes: notes || null,
        receipt_path: receiptPath,
        is_return: isReturn,
        ocr_confidence: ocrConfidence,
      }),
    })

    if (res.ok) {
      onSuccess()
    } else {
      const d = await res.json()
      setError(d.error)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {projects && (
        <div className="space-y-1">
          <Label>Project</Label>
          <Select
            value={selectedProjectId ?? ''}
            onValueChange={v => setSelectedProjectId(v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="No project — goes to Inbox" />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!selectedProjectId && (
            <p className="text-xs text-gray-400">No project selected — expense will go to Inbox</p>
          )}
        </div>
      )}
      <ReceiptUpload userId={userId} onResult={handleOcrResult} onError={setError} />

      {lowConfidence.length > 0 && (
        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
          Highlighted fields have low OCR confidence — please verify before saving.
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="vendor">Vendor</Label>
        <Input
          id="vendor"
          className={fieldClass('vendor')}
          value={vendor}
          onChange={e => setVendor(e.target.value)}
          placeholder="Store or vendor name"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount_net">Amount net (€) *</Label>
          <Input
            id="amount_net"
            type="number"
            step="0.01"
            min="0.01"
            className={fieldClass('amount_net')}
            value={amountNet}
            onChange={e => setAmountNet(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            className={fieldClass('date')}
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount_gross">Gross total (€)</Label>
        <Input
          id="amount_gross"
          type="number"
          step="0.01"
          min="0"
          value={amountGross}
          onChange={e => setAmountGross(e.target.value)}
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-gray-500">VAT breakdown — gross amounts (optional)</Label>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label htmlFor="amount_19" className="text-xs">19%</Label>
            <Input id="amount_19" type="number" step="0.01" min="0" value={amount19} onChange={e => setAmount19(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount_7" className="text-xs">7%</Label>
            <Input id="amount_7" type="number" step="0.01" min="0" value={amount7} onChange={e => setAmount7(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="amount_0" className="text-xs">0%</Label>
            <Input id="amount_0" type="number" step="0.01" min="0" value={amount0} onChange={e => setAmount0(e.target.value)} placeholder="0.00" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Category *</Label>
        <Select value={category} onValueChange={(v) => setCategory(v as 'general' | 'transport')}>
          <SelectTrigger className={fieldClass('category')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="transport">Transport</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Input
          id="notes"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Optional notes"
        />
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={isReturn}
          onChange={e => setIsReturn(e.target.checked)}
          className="rounded"
        />
        This is a return / refund
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Saving…' : 'Save expense'}
      </Button>
    </form>
  )
}
