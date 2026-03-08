'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ExpenseForm from './expense-form'
import type { Database } from '@/lib/supabase/types'

type Expense = Database['public']['Tables']['expenses']['Row']

const ReceiptViewerLazy = dynamic(() => import('./receipt-viewer'), {
  loading: () => <div className="h-48 bg-gray-100 animate-pulse rounded" />,
})

interface Props {
  projectId: string
  userId: string
  initialExpenses: Expense[]
}

export default function ExpenseListClient({ projectId, userId, initialExpenses }: Props) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null)

  const general = initialExpenses.filter(e => e.category === 'general')
  const transport = initialExpenses.filter(e => e.category === 'transport')

  function handleExpenseAdded() {
    setAddOpen(false)
    router.refresh()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Expenses</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"
            onClick={() => window.open(`/api/projects/${projectId}/export?format=pdf`, '_blank')}>
            Export PDF
          </Button>
          <Button variant="outline" size="sm"
            onClick={() => window.open(`/api/projects/${projectId}/export?format=csv`, '_blank')}>
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            Add Expense
          </Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
          <ExpenseForm userId={userId} projectId={projectId} onSuccess={handleExpenseAdded} />
        </DialogContent>
      </Dialog>

      {selectedExpense && (
        <Dialog open={!!selectedExpense} onOpenChange={open => { if (!open) setSelectedExpense(null) }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Expense Detail</DialogTitle></DialogHeader>
            <ExpenseDetail
              expense={selectedExpense}
              onClose={() => { setSelectedExpense(null); router.refresh() }}
            />
          </DialogContent>
        </Dialog>
      )}

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All ({initialExpenses.length})</TabsTrigger>
          <TabsTrigger value="general">General ({general.length})</TabsTrigger>
          <TabsTrigger value="transport">Transport ({transport.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <ExpenseTable expenses={initialExpenses} onSelect={setSelectedExpense} />
        </TabsContent>
        <TabsContent value="general">
          <ExpenseTable expenses={general} onSelect={setSelectedExpense} />
        </TabsContent>
        <TabsContent value="transport">
          <ExpenseTable expenses={transport} onSelect={setSelectedExpense} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function ExpenseTable({ expenses, onSelect }: { expenses: Expense[]; onSelect: (e: Expense) => void }) {
  if (expenses.length === 0) {
    return <p className="text-sm text-gray-500 py-4">No expenses yet.</p>
  }
  return (
    <div className="divide-y">
      {expenses.map(expense => (
        <button key={expense.id} onClick={() => onSelect(expense)}
          className="w-full text-left px-2 py-3 hover:bg-gray-50 transition-colors rounded">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{expense.vendor ?? 'Unknown vendor'}</p>
              <p className="text-xs text-gray-500">{expense.date} · {expense.category}</p>
            </div>
            <p className={`text-sm font-medium ${expense.is_return ? 'text-green-600' : ''}`}>
              {expense.is_return ? '+' : ''}€{Math.abs(expense.amount).toFixed(2)}
              {expense.is_return && <span className="text-xs ml-1">(return)</span>}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}

function ExpenseDetail({ expense, onClose }: { expense: Expense; onClose: () => void }) {
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('Delete this expense?')) return
    setDeleting(true)
    await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
    onClose()
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-gray-500">Vendor</dt><dd className="font-medium">{expense.vendor ?? '—'}</dd></div>
        <div>
          <dt className="text-gray-500">Amount</dt>
          <dd className="font-medium">
            {expense.is_return ? '+' : ''}€{Math.abs(expense.amount).toFixed(2)}
            {expense.is_return && <span className="text-xs ml-1 text-green-600">(return)</span>}
          </dd>
        </div>
        <div><dt className="text-gray-500">Date</dt><dd className="font-medium">{expense.date}</dd></div>
        <div><dt className="text-gray-500">Category</dt><dd className="font-medium capitalize">{expense.category}</dd></div>
        {expense.notes && (
          <div className="col-span-2"><dt className="text-gray-500">Notes</dt><dd className="font-medium">{expense.notes}</dd></div>
        )}
      </dl>

      {expense.receipt_path && (
        <div>
          <p className="text-sm text-gray-500 mb-2">Receipt</p>
          <ReceiptViewerLazy path={expense.receipt_path} />
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="destructive" size="sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete'}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
      </div>
    </div>
  )
}
