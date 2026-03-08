'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Inbox, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const links = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox', icon: Inbox },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export default function MobileNav({ className }: { className?: string }) {
  const pathname = usePathname()
  return (
    <nav className={cn('flex border-b bg-white', className)}>
      {links.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href}
          className={cn(
            'flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors',
            pathname === href ? 'text-gray-900 font-medium' : 'text-gray-500'
          )}>
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
    </nav>
  )
}
