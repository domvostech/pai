import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { calculateBudgetSummary } from '@/lib/budget'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ExpenseListClient from '@/components/expenses/expense-list-client'
import ProjectCostCenterField from '@/components/projects/project-cost-center-field'
import type { Database } from '@/lib/supabase/types'

type Expense = Database['public']['Tables']['expenses']['Row']

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: project } = await supabase
    .from('projects')
    .select('*, client:clients(id, name, email), expenses(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!project) notFound()

  type ProjectWithRelations = Database['public']['Tables']['projects']['Row'] & {
    client: { id: string; name: string; email: string | null } | null
    expenses: Expense[]
  }
  const p = project as unknown as ProjectWithRelations

  const expenses = p.expenses ?? []
  const summary = calculateBudgetSummary(p.total_budget, expenses)
  const client = p.client

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" />
        All projects
      </Link>

      {/* Project header */}
      <div>
        <h1 className="text-2xl font-bold">{p.name}</h1>
        {client && <p className="text-sm text-gray-500 mt-1">{client.name}</p>}
        <ProjectCostCenterField projectId={id} initialValue={p.cost_center} />
      </div>

      {/* Budget summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Budget</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold">€{summary.totalBudget.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">General</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold">€{summary.spentGeneral.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Transport</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-xl font-bold">€{summary.spentTransport.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className={summary.isOverBudget ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wide">Remaining</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className={`text-xl font-bold ${summary.isOverBudget ? 'text-red-600' : 'text-green-600'}`}>
              €{summary.remaining.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overbudget warning */}
      {summary.isOverBudget && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          This project is over budget by €{Math.abs(summary.remaining).toFixed(2)}.
        </div>
      )}

      {/* Expenses */}
      <ExpenseListClient
        projectId={id}
        userId={user.id}
        initialExpenses={expenses}
      />
    </div>
  )
}
