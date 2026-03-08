'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ClientForm from '@/components/clients/client-form'
import type { Database } from '@/lib/supabase/types'

type Client = Database['public']['Tables']['clients']['Row']
type Project = Database['public']['Tables']['projects']['Row']

interface Props {
  onSuccess: (project: Project) => void
}

export default function ProjectForm({ onSuccess }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')
  const [clientId, setClientId] = useState<string>('')
  const [clients, setClients] = useState<Client[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      fetch('/api/clients').then(r => r.json()).then(setClients).catch(() => {})
    }
  }, [open])

  function handleNewClient(client: Client) {
    setClients(prev => [...prev, client].sort((a, b) => a.name.localeCompare(b.name)))
    setClientId(client.id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        total_budget: parseFloat(budget) || 0,
        client_id: clientId || null,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error)
      setLoading(false)
      return
    }

    setOpen(false)
    setName('')
    setBudget('')
    setClientId('')
    setLoading(false)
    onSuccess(data)
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New Project</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Spring Collection 2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Client</Label>
              <div className="flex gap-2">
                <Select value={clientId} onValueChange={(v) => setClientId(v ?? '')}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ClientForm
                  trigger={<Button type="button" variant="outline" size="sm">+ New</Button>}
                  onSuccess={handleNewClient}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (€)</Label>
              <Input
                id="budget"
                type="number"
                min="0"
                step="0.01"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                placeholder="0.00"
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving…' : 'Create project'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
