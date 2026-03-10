'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  projectId: string
  initialValue: string | null
}

export default function ProjectCostCenterField({ projectId, initialValue }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    await fetch(`/api/projects/${projectId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cost_center: value.trim() || null }),
    })
    setSaving(false)
    setEditing(false)
    router.refresh()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 mt-1">
        <input
          className="text-sm border rounded px-2 py-1 w-40"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="e.g. 597B"
          autoFocus
        />
        <button onClick={save} disabled={saving} className="text-sm text-gray-700 hover:text-black">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={() => { setValue(initialValue ?? ''); setEditing(false) }}
          className="text-sm text-gray-400 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <p className="text-sm text-gray-500 mt-1">
      Cost centre: <span className="font-medium text-gray-700">{initialValue ?? '—'}</span>
      {' '}
      <button onClick={() => setEditing(true)} className="text-xs text-gray-400 hover:text-gray-700 underline">
        edit
      </button>
    </p>
  )
}
