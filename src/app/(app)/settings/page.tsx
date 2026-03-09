import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SettingsClient from '@/components/settings/settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Pre-fetch inbound token server-side
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
    <div className="max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">{user.email}</p>
      </div>
      <SettingsClient inboundAddress={inboundAddress} />
    </div>
  )
}
