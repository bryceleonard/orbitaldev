'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MarkdownBody } from '@/components/ui/markdown-body'
import type { Milestone, MilestoneStatus } from '@/lib/types'

interface Props {
  milestone: Milestone
  canEdit: boolean
  onStatusChange: (milestone: Milestone, newStatus: MilestoneStatus) => Promise<void>
  onUpdate: (id: string, data: { name: string; startDate?: string; endDate?: string; description?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const SCHEDULED_STATUSES: MilestoneStatus[] = ['not_started', 'in_progress', 'blocked', 'completed']
const STATUS_LABELS: Record<MilestoneStatus, string> = {
  backlog: 'Backlog',
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

export function BacklogItemCard({ milestone, canEdit, onStatusChange, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(milestone.name)
  const [editDesc, setEditDesc] = useState(milestone.description ?? '')
  const [editStart, setEditStart] = useState(milestone.startDate ?? '')
  const [editEnd, setEditEnd] = useState(milestone.endDate ?? '')
  const [saving, setSaving] = useState(false)
  const [dateError, setDateError] = useState(false)

  const hasDates = !!milestone.startDate && !!milestone.endDate

  function openEdit() {
    setEditName(milestone.name)
    setEditDesc(milestone.description ?? '')
    setEditStart(milestone.startDate ?? '')
    setEditEnd(milestone.endDate ?? '')
    setEditing(true)
  }

  async function handleSave() {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await onUpdate(milestone.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        startDate: editStart || undefined,
        endDate: editEnd || undefined,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: MilestoneStatus) {
    if (newStatus !== 'backlog' && !hasDates) {
      setDateError(true)
      return
    }
    setDateError(false)
    await onStatusChange(milestone, newStatus)
  }

  if (editing) {
    return (
      <div className="rounded-lg border p-4 bg-muted/30 flex flex-col gap-3">
        <div>
          <Label className="text-xs mb-1">Name</Label>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs mb-1">Description (markdown)</Label>
          <textarea
            className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/50"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Describe this backlog item…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">Start Date (optional)</Label>
            <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1">End Date (optional)</Label>
            <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <p className="font-medium">{milestone.name}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={milestone.status}
            disabled={!canEdit}
            onChange={(e) => handleStatusChange(e.target.value as MilestoneStatus)}
            className="text-sm border rounded px-2 py-1 bg-background outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
          >
            <option value="backlog">Backlog</option>
            {SCHEDULED_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {canEdit && (
            <>
              <Button size="sm" variant="ghost" onClick={openEdit}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(milestone.id)}>Delete</Button>
            </>
          )}
        </div>
      </div>
      {dateError && (
        <p className="text-xs text-destructive mb-2">Add start and end dates before scheduling.</p>
      )}
      {milestone.startDate && milestone.endDate && (
        <p className="text-xs text-muted-foreground mb-2">{milestone.startDate} – {milestone.endDate}</p>
      )}
      {milestone.description ? (
        <MarkdownBody content={milestone.description} />
      ) : (
        <p className="text-sm text-muted-foreground italic">No description.</p>
      )}
    </div>
  )
}
