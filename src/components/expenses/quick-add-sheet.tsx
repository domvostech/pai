'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import ExpenseForm from './expense-form'

interface Props {
  userId: string
  open: boolean
  onClose: () => void
}

export default function QuickAddSheet({ userId, open, onClose }: Props) {
  const router = useRouter()
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
  const [openKey, setOpenKey] = useState(0)
  const hasFetched = useRef(false)

  useEffect(() => {
    if (open) setOpenKey(k => k + 1)
  }, [open])

  useEffect(() => {
    if (open && !hasFetched.current) {
      hasFetched.current = true
      fetch('/api/projects')
        .then(r => r.json())
        .then((data: Array<{ id: string; name: string }>) =>
          setProjects((data ?? []).map(p => ({ id: p.id, name: p.name })))
        )
        .catch(() => {})
    }
  }, [open])

  function handleSuccess() {
    onClose()
    router.refresh()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/40 z-[60] transition-opacity duration-300',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl transition-transform duration-300',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
        style={{ maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2">
          <h2 className="text-lg font-semibold">Add Expense</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-4 pb-8">
          <ExpenseForm
            key={openKey}
            userId={userId}
            projects={projects}
            onSuccess={handleSuccess}
          />
        </div>
      </div>
    </>
  )
}
