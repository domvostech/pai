'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import type { Database } from '@/lib/supabase/types'

type Expense = Database['public']['Tables']['expenses']['Row']
type Project = Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'name'>

const ReceiptViewerLazy = dynamic(() => import('@/components/expenses/receipt-viewer'), {
  loading: () => <div className="h-32 bg-gray-100 animate-pulse rounded" />,
})

interface Props {
  initialExpenses: Expense[]
  projects: Project[]
  inboundAddress: string | null
}

export default function InboxClient({ initialExpenses, projects, inboundAddress }: Props) {
  const router = useRouter()
  const [expenses, setExpenses] = useState(initialExpenses)
  const [assigning, setAssigning] = useState<Record<string, boolean>>({})

  const isNoInfo = (e: Expense) =>
    e.vendor?.startsWith('No relevant information found') ?? false

  async function assignToProject(expenseId: string, projectId: string) {
    setAssigning(prev => ({ ...prev, [expenseId]: true }))
    await fetch(`/api/expenses/${expenseId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    })
    setExpenses(prev => prev.filter(e => e.id !== expenseId))
    setAssigning(prev => ({ ...prev, [expenseId]: false }))
    router.refresh()
  }

  async function discard(expenseId: string) {
    if (!confirm('Discard this receipt?')) return
    await fetch(`/api/expenses/${expenseId}`, { method: 'DELETE' })
    setExpenses(prev => prev.filter(e => e.id !== expenseId))
  }

  if (expenses.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-500">
          Your inbox is empty. Forward receipts to your inbound email address to get started.
        </p>
        {inboundAddress && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Forward receipts to:</p>
            <p className="text-sm font-mono bg-gray-100 rounded px-3 py-2 break-all">
              {inboundAddress}
            </p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {expenses.map(expense => (
        <Card key={expense.id} className={isNoInfo(expense) ? 'border-amber-200 bg-amber-50' : ''}>
          <CardContent className="pt-4">
            {isNoInfo(expense) ? (
              <p className="text-sm font-medium text-amber-700 mb-3">{expense.vendor}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                <div>
                  <p className="text-gray-500 text-xs">Vendor</p>
                  <p className="font-medium">{expense.vendor ?? '—'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Amount</p>
                  <p className="font-medium">€{Math.abs(expense.amount).toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Date</p>
                  <p className="font-medium">{expense.date}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Category</p>
                  <p className="font-medium capitalize">{expense.category}</p>
                </div>
                {expense.notes && (
                  <div className="col-span-2">
                    <p className="text-gray-500 text-xs">Notes</p>
                    <p className="font-medium">{expense.notes}</p>
                  </div>
                )}
              </div>
            )}

            {expense.receipt_path && (
              <div className="mb-3">
                <ReceiptViewerLazy path={expense.receipt_path} />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Select
                onValueChange={value => {
                  const projectId = value as string
                  if (projectId) assignToProject(expense.id, projectId)
                }}
                disabled={assigning[expense.id]}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Assign to project…" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => discard(expense.id)}
                disabled={assigning[expense.id]}
              >
                Discard
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
