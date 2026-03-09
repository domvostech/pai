import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get existing token or create one
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
  return NextResponse.json({
    token: tokenRow?.token ?? null,
    address: tokenRow ? `${tokenRow.token}@${domain}` : null,
  })
}
