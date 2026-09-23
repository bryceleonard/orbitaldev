'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BacklogItemCard } from '@/components/milestones/backlog-item-card'
import type { Milestone, MilestoneStatus } from '@/lib/types'

interface Props {
  milestones: Milestone[]
  canEdit: boolean
  onAddMilestone: (data: { name: string; startDate: string; endDate: string }) => Promise<void>
  onAddBacklog: (data: { name: string; description?: string }) => Promise<void>
  onStatusChange: (milestone: Milestone, newStatus: MilestoneStatus) => Promise<void>
  onUpdate: (id: string, data: { name: string; startDate?: string; endDate?: string; description?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  backlog: 'Backlog',
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  backlog: 'text-muted-foreground',
  not_started: 'text-muted-foreground',
  in_progress: 'text-primary',
  blocked: 'text-destructive',
  completed: 'text-green-600',
}

const SCHEDULED_STATUSES: MilestoneStatus[] = ['backlog', 'not_started', 'in_progress', 'blocked', 'completed']

export function MilestonesManager({
  milestones,
  canEdit,
  onAddMilestone,
  onAddBacklog,
  onStatusChange,
  onUpdate,
  onDelete,
}: Props) {
  // ── Add milestone form state ──────────────────────────────────────────────
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [addName, setAddName] = useState('')
  const [addStart, setAddStart] = useState('')
  const [addEnd, setAddEnd] = useState('')
  const [savingMilestone, setSavingMilestone] = useState(false)

  // ── Add backlog form state ────────────────────────────────────────────────
  const [addingBacklog, setAddingBacklog] = useState(false)
  const [addBacklogName, setAddBacklogName] = useState('')
  const [addBacklogDesc, setAddBacklogDesc] = useState('')
  const [savingBacklog, setSavingBacklog] = useState(false)

  // ── Edit scheduled milestone state ────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // ── Split milestones ──────────────────────────────────────────────────────
  const scheduled = [...milestones.filter((m) => m.status !== 'backlog')].sort(
    (a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''),
  )
  const backlog = [...milestones.filter((m) => m.status === 'backlog')].sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleAddMilestone() {
    if (!addName.trim() || !addStart || !addEnd) return
    setSavingMilestone(true)
    try {
      await onAddMilestone({ name: addName.trim(), startDate: addStart, endDate: addEnd })
      setAddingMilestone(false)
      setAddName('')
      setAddStart('')
      setAddEnd('')
    } finally {
      setSavingMilestone(false)
    }
  }

  async function handleAddBacklog() {
    if (!addBacklogName.trim()) return
    setSavingBacklog(true)
    try {
      await onAddBacklog({
        name: addBacklogName.trim(),
        description: addBacklogDesc.trim() || undefined,
      })
      setAddingBacklog(false)
      setAddBacklogName('')
      setAddBacklogDesc('')
    } finally {
      setSavingBacklog(false)
    }
  }

  function startEdit(m: Milestone) {
    setEditingId(m.id)
    setEditName(m.name)
    setEditStart(m.startDate ?? '')
    setEditEnd(m.endDate ?? '')
    setEditDesc(m.description ?? '')
  }

  async function handleUpdate(id: string) {
    if (!editName.trim() || !editStart || !editEnd) return
    setSavingEdit(true)
    try {
      await onUpdate(id, {
        name: editName.trim(),
        startDate: editStart,
        endDate: editEnd,
        description: editDesc.trim() || undefined,
      })
      setEditingId(null)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Scheduled Milestones ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Milestones</h2>
          {canEdit && !addingMilestone && (
            <Button size="sm" onClick={() => setAddingMilestone(true)}>
              Add milestone
            </Button>
          )}
        </div>

        {addingMilestone && (
          <div className="mb-4 rounded-lg border p-4 bg-muted/30">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <Label htmlFor="add-name" className="text-xs mb-1">Name</Label>
                <Input id="add-name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Milestone name" />
              </div>
              <div>
                <Label htmlFor="add-start" className="text-xs mb-1">Start Date</Label>
                <Input id="add-start" type="date" value={addStart} onChange={(e) => setAddStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="add-end" className="text-xs mb-1">End Date</Label>
                <Input id="add-end" type="date" value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddMilestone} disabled={savingMilestone}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingMilestone(false); setAddName(''); setAddStart(''); setAddEnd('') }}>Cancel</Button>
            </div>
          </div>
        )}

        {scheduled.length === 0 && !addingMilestone ? (
          <p className="text-sm text-muted-foreground">No scheduled milestones yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {scheduled.map((m) =>
              editingId === m.id ? (
                <div key={m.id} className="p-3 bg-muted/30 flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor={`edit-name-${m.id}`} className="text-xs mb-1">Name</Label>
                      <Input id={`edit-name-${m.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor={`edit-start-${m.id}`} className="text-xs mb-1">Start Date</Label>
                      <Input id={`edit-start-${m.id}`} type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor={`edit-end-${m.id}`} className="text-xs mb-1">End Date</Label>
                      <Input id={`edit-end-${m.id}`} type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`edit-desc-${m.id}`} className="text-xs mb-1">Notes (markdown, optional)</Label>
                    <textarea
                      id={`edit-desc-${m.id}`}
                      className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/50"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Optional notes…"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(m.id)} disabled={savingEdit}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
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
                    {SCHEDULED_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  {canEdit && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(m)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(m.id)}>Delete</Button>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* ── Backlog ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Backlog</h2>
          {canEdit && !addingBacklog && (
            <Button size="sm" variant="outline" onClick={() => setAddingBacklog(true)}>
              Add backlog item
            </Button>
          )}
        </div>

        {addingBacklog && (
          <div className="mb-4 rounded-lg border p-4 bg-muted/30 flex flex-col gap-3">
            <div>
              <Label htmlFor="add-backlog-name" className="text-xs mb-1">Name</Label>
              <Input id="add-backlog-name" value={addBacklogName} onChange={(e) => setAddBacklogName(e.target.value)} placeholder="Backlog item name" />
            </div>
            <div>
              <Label htmlFor="add-backlog-desc" className="text-xs mb-1">Description (markdown, optional)</Label>
              <textarea
                id="add-backlog-desc"
                className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/50"
                value={addBacklogDesc}
                onChange={(e) => setAddBacklogDesc(e.target.value)}
                placeholder="Describe this backlog item…"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddBacklog} disabled={savingBacklog}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingBacklog(false); setAddBacklogName(''); setAddBacklogDesc('') }}>Cancel</Button>
            </div>
          </div>
        )}

        {backlog.length === 0 && !addingBacklog ? (
          <p className="text-sm text-muted-foreground">No backlog items.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {backlog.map((m) => (
              <BacklogItemCard
                key={m.id}
                milestone={m}
                canEdit={canEdit}
                onStatusChange={onStatusChange}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
