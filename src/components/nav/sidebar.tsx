'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Inbox, Settings, LogOut, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import QuickAddSheet from '@/components/expenses/quick-add-sheet'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/settings', label: 'Settings', icon: Settings },
]

interface Props {
  className?: string
  userId: string
  inboxCount: number
}

export default function Sidebar({ className, userId, inboxCount }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <>
      <aside className={cn('w-56 flex flex-col border-r bg-white px-3 py-6', className)}>
        <div className="mb-8 px-3 text-xl font-bold tracking-tight">PAI</div>
        <nav className="flex-1 space-y-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                pathname === href
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {href === '/inbox' && inboxCount > 0 && (
                <span className="ml-auto text-xs bg-gray-200 text-gray-700 rounded-full px-1.5 py-0.5 leading-none">
                  {inboxCount}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium bg-black text-white hover:bg-gray-800 transition-colors mb-2"
        >
          <Plus className="h-4 w-4" />
          Add Expense
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </aside>

      <QuickAddSheet
        userId={userId}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  )
}
