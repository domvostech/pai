import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateExpenseReportPdf } from '@/lib/pdf-export'
import type { Database } from '@/lib/supabase/types'

type Expense = Database['public']['Tables']['expenses']['Row']

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format') ?? 'pdf'

  // Fetch project with client and expenses
  const { data: project } = await supabase
    .from('projects')
    .select('*, client:clients(id, name, email)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const proj = project as unknown as { name: string; total_budget: number; client: { id: string; name: string; email: string | null } | null }

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  const expenseList: Expense[] = (expenses ?? []) as Expense[]
  const safeProjectName = (proj.name ?? 'project').replace(/[^a-zA-Z0-9-_]/g, '_')

  // CSV export
  if (format === 'csv') {
    const header = 'Date,Vendor,Amount Net,Category,Return,Notes\n'
    const rows = expenseList
      .map(e => {
        const vendor = (e.vendor ?? '').replace(/"/g, '""')
        const notes = (e.notes ?? '').replace(/"/g, '""')
        return `${e.date},"${vendor}",${e.amount_net},${e.category},${e.is_return},"${notes}"`
      })
      .join('\n')

    return new NextResponse(header + rows, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeProjectName}-expenses.csv"`,
      },
    })
  }

  // PDF export — fetch receipt buffers
  const receiptBuffers: { path: string; buffer: Uint8Array; mimeType: string }[] = []
  for (const expense of expenseList) {
    if (expense.receipt_path) {
      const { data } = await supabase.storage.from('receipts').download(expense.receipt_path)
      if (data) {
        const buffer = new Uint8Array(await data.arrayBuffer())
        const mimeType = expense.receipt_path.endsWith('.pdf')
          ? 'application/pdf'
          : expense.receipt_path.endsWith('.png')
            ? 'image/png'
            : 'image/jpeg'
        receiptBuffers.push({ path: expense.receipt_path, buffer, mimeType })
      }
    }
  }

  const clientData = proj.client

  const pdfBytes = await generateExpenseReportPdf({
    project: { name: proj.name, total_budget: proj.total_budget },
    client: clientData ? { name: clientData.name } : null,
    expenses: expenseList,
    receiptBuffers,
  })

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeProjectName}-expense-report.pdf"`,
    },
  })
}
