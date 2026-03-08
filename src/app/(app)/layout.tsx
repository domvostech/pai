import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/nav/sidebar'
import MobileNav from '@/components/nav/mobile-nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar className="hidden md:flex" />
      <main className="flex-1 overflow-auto flex flex-col">
        <MobileNav className="md:hidden" />
        <div className="flex-1 p-4 md:p-8 pb-16 md:pb-8">{children}</div>
      </main>
    </div>
  )
}
