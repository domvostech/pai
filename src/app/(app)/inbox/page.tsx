import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InboxClient from '@/components/inbox/inbox-client'
import type { Database } from '@/lib/supabase/types'

type Expense = Database['public']['Tables']['expenses']['Row']

export default async function InboxPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .is('project_id', null)
    .order('created_at', { ascending: false })

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name')
    .eq('user_id', user.id)
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Inbox</h1>
      <p className="text-sm text-gray-500 mb-6">
        Receipts forwarded by email appear here. Assign them to a project or discard them.
      </p>
      <InboxClient
        initialExpenses={(expenses ?? []) as Expense[]}
        projects={projects ?? []}
      />
    </div>
  )
}
