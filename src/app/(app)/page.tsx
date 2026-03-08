import { createClient } from '@/lib/supabase/server'
import { calculateBudgetSummary } from '@/lib/budget'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import NewProjectButton from '@/components/projects/new-project-button'
import type { Database } from '@/lib/supabase/types'

type Expense = Database['public']['Tables']['expenses']['Row']
type Project = Database['public']['Tables']['projects']['Row']

interface ProjectWithRelations extends Project {
  client: { name: string } | null
  expenses: Pick<Expense, 'amount' | 'is_return' | 'category'>[]
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('*, client:clients(name), expenses(amount, is_return, category)')
    .order('created_at', { ascending: false })

  const projects = data as unknown as ProjectWithRelations[] | null

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <NewProjectButton />
      </div>
      {(!projects || projects.length === 0) && (
        <p className="text-gray-500 text-sm">No projects yet. Create one to get started.</p>
      )}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {projects?.map(project => {
          const summary = calculateBudgetSummary(
            project.total_budget,
            project.expenses as unknown as Expense[]
          )
          return (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{project.name}</CardTitle>
                  {project.client?.name && (
                    <p className="text-sm text-gray-500">{project.client.name}</p>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Budget</span>
                      <span>€{summary.totalBudget.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Spent</span>
                      <span>€{summary.totalSpent.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Remaining</span>
                      <span className={summary.isOverBudget ? 'text-red-600' : 'text-green-600'}>
                        €{summary.remaining.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
