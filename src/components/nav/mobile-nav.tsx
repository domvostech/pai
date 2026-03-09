'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Inbox, Settings, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import QuickAddSheet from '@/components/expenses/quick-add-sheet'

interface Props {
  className?: string
  userId: string
}

export default function MobileNav({ className, userId }: Props) {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav className={cn('flex items-end border-t bg-white fixed bottom-0 left-0 right-0 z-50', className)}>
        {/* Left tabs */}
        {[
          { href: '/', label: 'Dashboard', icon: LayoutDashboard },
          { href: '/inbox', label: 'Inbox', icon: Inbox },
        ].map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors',
              pathname === href ? 'text-gray-900 font-medium' : 'text-gray-500'
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}

        {/* Raised centre button */}
        <div className="flex flex-1 flex-col items-center pb-2">
          <button
            onClick={() => setSheetOpen(true)}
            className="-mt-5 h-14 w-14 rounded-full bg-black text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
            aria-label="Add expense"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>

        {/* Right tab */}
        <Link
          href="/settings"
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors',
            pathname === '/settings' ? 'text-gray-900 font-medium' : 'text-gray-500'
          )}
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
      </nav>

      <QuickAddSheet
        userId={userId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
