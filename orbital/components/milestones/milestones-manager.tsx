'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Milestone, MilestoneStatus } from '@/lib/types'

interface Props {
  milestones: Milestone[]
  canEdit: boolean
  onAdd: (data: { name: string; startDate: string; endDate: string }) => Promise<void>
  onStatusChange: (milestone: Milestone, newStatus: MilestoneStatus) => Promise<void>
  onUpdate: (id: string, data: { name: string; startDate: string; endDate: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  not_started: 'text-muted-foreground',
  in_progress: 'text-primary',
  blocked: 'text-destructive',
  completed: 'text-green-600',
}

const ALL_STATUSES: MilestoneStatus[] = ['not_started', 'in_progress', 'blocked', 'completed']

export function MilestonesManager({ milestones, canEdit, onAdd, onStatusChange, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false)
  const [addName, setAddName] = useState('')
  const [addStart, setAddStart] = useState('')
  const [addEnd, setAddEnd] = useState('')
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')

  const sorted = [...milestones].sort((a, b) => a.startDate.localeCompare(b.startDate))

  async function handleAdd() {
    if (!addName.trim() || !addStart || !addEnd) return
    setSaving(true)
    try {
      await onAdd({ name: addName.trim(), startDate: addStart, endDate: addEnd })
      setAdding(false)
      setAddName('')
      setAddStart('')
      setAddEnd('')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(m: Milestone) {
    setEditingId(m.id)
    setEditName(m.name)
    setEditStart(m.startDate)
    setEditEnd(m.endDate)
  }

  async function handleUpdate(id: string) {
    if (!editName.trim() || !editStart || !editEnd) return
    setSaving(true)
    try {
      await onUpdate(id, { name: editName.trim(), startDate: editStart, endDate: editEnd })
      setEditingId(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Milestones</h2>
        {canEdit && !adding && (
          <Button size="sm" onClick={() => setAdding(true)}>
            Add milestone
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-4 rounded-lg border p-4 bg-muted/30">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <Label htmlFor="add-name" className="text-xs mb-1">Name</Label>
              <Input
                id="add-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Milestone name"
              />
            </div>
            <div>
              <Label htmlFor="add-start" className="text-xs mb-1">Start Date</Label>
              <Input
                id="add-start"
                type="date"
                value={addStart}
                onChange={(e) => setAddStart(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="add-end" className="text-xs mb-1">End Date</Label>
              <Input
                id="add-end"
                type="date"
                value={addEnd}
                onChange={(e) => setAddEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false)
                setAddName('')
                setAddStart('')
                setAddEnd('')
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {sorted.length === 0 && !adding ? (
        <p className="text-sm text-muted-foreground">No milestones yet.</p>
      ) : (
        <div className="rounded-lg border divide-y">
          {sorted.map((m) =>
            editingId === m.id ? (
              <div key={m.id} className="p-3 bg-muted/30">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <Label htmlFor={`edit-name-${m.id}`} className="text-xs mb-1">Name</Label>
                    <Input
                      id={`edit-name-${m.id}`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-start-${m.id}`} className="text-xs mb-1">Start Date</Label>
                    <Input
                      id={`edit-start-${m.id}`}
                      type="date"
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`edit-end-${m.id}`} className="text-xs mb-1">End Date</Label>
                    <Input
                      id={`edit-end-${m.id}`}
                      type="date"
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleUpdate(m.id)} disabled={saving}>
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.startDate} – {m.endDate}
                  </p>
                </div>

                <select
                  value={m.status}
                  disabled={!canEdit}
                  onChange={(e) => onStatusChange(m, e.target.value as MilestoneStatus)}
                  className={`text-sm border rounded px-2 py-1 bg-background outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50 ${STATUS_COLOR[m.status]}`}
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>

                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(m)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => onDelete(m.id)}>
                      Delete
                    </Button>
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
