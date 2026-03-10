import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('project_id')
  const inbox = searchParams.get('inbox') === 'true'

  let query = supabase
    .from('expenses')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })

  if (inbox) {
    query = query.is('project_id', null)
  } else if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { project_id, vendor, amount_net, amount_gross, amount_19, amount_7, amount_0, date, category, notes, receipt_path, is_return, ocr_confidence } = body

  const parsedAmountNet = Number(amount_net)
  if (amount_net === undefined || amount_net === null || isNaN(parsedAmountNet) || parsedAmountNet <= 0) {
    return NextResponse.json({ error: 'amount_net must be a positive number' }, { status: 400 })
  }
  if (!date) {
    return NextResponse.json({ error: 'date is required' }, { status: 400 })
  }
  if (!['general', 'transport'].includes(category)) {
    return NextResponse.json({ error: 'category must be general or transport' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: user.id,
      project_id: project_id || null,
      vendor: vendor || null,
      amount_net: parsedAmountNet,
      amount_gross: amount_gross != null ? Number(amount_gross) : null,
      amount_19: amount_19 != null ? Number(amount_19) : null,
      amount_7: amount_7 != null ? Number(amount_7) : null,
      amount_0: amount_0 != null ? Number(amount_0) : null,
      date,
      category,
      notes: notes || null,
      receipt_path: receipt_path || null,
      is_return: is_return ?? false,
      ocr_confidence: ocr_confidence || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
