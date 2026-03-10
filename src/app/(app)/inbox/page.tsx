import crypto from 'crypto'
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

  let { data: tokenRow } = await supabase
    .from('inbound_tokens')
    .select('token')
    .eq('user_id', user.id)
    .single()

  if (!tokenRow) {
    const token = crypto.randomBytes(12).toString('hex')
    const { data: newRow } = await supabase
      .from('inbound_tokens')
      .insert({ user_id: user.id, token })
      .select('token')
      .single()
    tokenRow = newRow
  }

  const domain = process.env.INBOUND_EMAIL_DOMAIN ?? 'mail.yourapp.com'
  const inboundAddress = tokenRow ? `${tokenRow.token}@${domain}` : null

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Inbox</h1>
      <p className="text-sm text-gray-500 mb-6">
        Receipts forwarded by email appear here. Assign them to a project or discard them.
      </p>
      <InboxClient
        initialExpenses={(expenses ?? []) as Expense[]}
        projects={projects ?? []}
        inboundAddress={inboundAddress}
      />
    </div>
  )
}
