import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // Allowlist safe fields only
  const allowed: Record<string, unknown> = {}
  if (body.project_id !== undefined) allowed.project_id = body.project_id
  if (body.vendor !== undefined) allowed.vendor = body.vendor
  if (body.amount_net !== undefined) allowed.amount_net = Number(body.amount_net)
  if (body.amount_gross !== undefined) allowed.amount_gross = body.amount_gross != null ? Number(body.amount_gross) : null
  if (body.amount_19 !== undefined) allowed.amount_19 = body.amount_19 != null ? Number(body.amount_19) : null
  if (body.amount_7 !== undefined) allowed.amount_7 = body.amount_7 != null ? Number(body.amount_7) : null
  if (body.amount_0 !== undefined) allowed.amount_0 = body.amount_0 != null ? Number(body.amount_0) : null
  if (body.date !== undefined) allowed.date = body.date
  if (body.category !== undefined) allowed.category = body.category
  if (body.notes !== undefined) allowed.notes = body.notes
  if (body.is_return !== undefined) allowed.is_return = body.is_return

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(allowed)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get the expense to find receipt_path before deleting
  const { data: expense } = await supabase
    .from('expenses')
    .select('receipt_path')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete the expense
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Delete receipt from storage if it exists
  if (expense.receipt_path) {
    await supabase.storage.from('receipts').remove([expense.receipt_path])
  }

  return new NextResponse(null, { status: 204 })
}
