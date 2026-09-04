'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listDecisions, addDecision, updateDecision, deleteDecision } from '@/lib/firestore/decisions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Decision, DecisionStatus } from '@/lib/types'

const PRIORITY_CLASS: Record<string, string> = {
  low:    'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high:   'bg-red-100 text-red-800 border-red-200',
}

const STATUS_CLASS: Record<DecisionStatus, string> = {
  open:              'bg-amber-100 text-amber-800 border-amber-200',
  pending_input:     'bg-blue-100 text-blue-800 border-blue-200',
  decided:           'bg-green-100 text-green-800 border-green-200',
  revisit_requested: 'bg-red-100 text-red-800 border-red-200',
  closed:            'bg-gray-100 text-gray-600 border-gray-200',
}

const STATUS_LABEL: Record<DecisionStatus, string> = {
  open:              'Open',
  pending_input:     'Pending Input',
  decided:           'Decided',
  revisit_requested: 'Revisit Requested',
  closed:            'Closed',
}

const ACTIVE_STATUSES: DecisionStatus[] = ['open', 'pending_input', 'revisit_requested']

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysUntilDue(d: Decision): number | null {
  if (!d.dueDate || d.status === 'decided' || d.status === 'closed') return null
  const due = new Date(d.dueDate).getTime()
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return Math.round((due - now.getTime()) / 86_400_000)
}

function SummaryBar({ decisions }: { decisions: Decision[] }) {
  const today = todayStr()
  const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)

  const items = [
    {
      label: 'Open',
      count: decisions.filter((d) => d.status === 'open').length,
      cls: 'bg-amber-100 text-amber-800',
    },
    {
      label: 'Pending Input',
      count: decisions.filter((d) => d.status === 'pending_input').length,
      cls: 'bg-blue-100 text-blue-800',
    },
    {
      label: 'Decided',
      count: decisions.filter((d) => d.status === 'decided').length,
      cls: 'bg-green-100 text-green-800',
    },
    {
      label: 'Revisit Requested',
      count: decisions.filter((d) => d.status === 'revisit_requested').length,
      cls: 'bg-red-100 text-red-800',
    },
    {
      label: 'Overdue',
      count: decisions.filter(
        (d) => ACTIVE_STATUSES.includes(d.status) && d.dueDate && d.dueDate < today,
      ).length,
      cls: 'bg-red-100 text-red-800',
    },
    {
      label: 'Due ≤ 7 days',
      count: decisions.filter(
        (d) =>
          ACTIVE_STATUSES.includes(d.status) &&
          d.dueDate &&
          d.dueDate >= today &&
          d.dueDate <= in7,
      ).length,
      cls: 'bg-orange-100 text-orange-800',
    },
  ]

  return (
    <div className="flex flex-wrap gap-3">
      {items.map(({ label, count, cls }) => (
        <div key={label} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm ${cls}`}>
          <span className="font-bold">{count}</span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

type DraftDecision = Omit<Decision, 'id' | 'seqId' | 'createdAt' | 'updatedAt' | 'createdBy'>

function emptyDraft(): DraftDecision {
  return {
    question: '',
    background: '',
    responsible: '',
    accountable: '',
    consulted: '',
    informed: '',
    priority: 'medium',
    status: 'open',
    dateIdentified: todayStr(),
    dueDate: '',
    dateDecided: '',
    outcome: '',
    timesRevisited: 0,
    notes: '',
  }
}

type FormValue = DraftDecision | Decision

function DecisionForm({
  value,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  value: FormValue
  onChange: (key: string, val: unknown) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  const v = value as Record<string, unknown>

  const tf = (key: string, label: string) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <Input value={String(v[key] ?? '')} onChange={(e) => onChange(key, e.target.value)} />
    </div>
  )

  const ta = (key: string, label: string) => (
    <div className="col-span-2">
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <textarea
        value={String(v[key] ?? '')}
        onChange={(e) => onChange(key, e.target.value)}
        rows={2}
        className="border rounded px-2 py-1.5 text-sm w-full resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )

  const sel = (key: string, label: string, options: string[]) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <select
        value={String(v[key] ?? '')}
        onChange={(e) => onChange(key, e.target.value)}
        className="border rounded px-2 py-1.5 text-sm w-full"
      >
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  )

  const dt = (key: string, label: string) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type="date"
        value={String(v[key] ?? '')}
        onChange={(e) => onChange(key, e.target.value)}
        className="border rounded px-2 py-1.5 text-sm w-full"
      />
    </div>
  )

  const num = (key: string, label: string) => (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type="number"
        min={0}
        value={Number(v[key] ?? 0)}
        onChange={(e) => onChange(key, Number(e.target.value))}
        className="border rounded px-2 py-1.5 text-sm w-24"
      />
    </div>
  )

  return (
    <div className="grid grid-cols-2 gap-3 p-4 bg-muted/20">
      {ta('question', 'Question')}
      {ta('background', 'Background / Context')}
      {tf('responsible', 'Responsible — R')}
      {tf('accountable', 'Accountable — A')}
      {tf('consulted', 'Consulted — C')}
      {tf('informed', 'Informed — I')}
      {sel('priority', 'Priority', ['low', 'medium', 'high'])}
      {sel('status', 'Status', ['open', 'pending_input', 'decided', 'revisit_requested', 'closed'])}
      {dt('dateIdentified', 'Date Identified')}
      {dt('dueDate', 'Due Date')}
      {dt('dateDecided', 'Date Decided')}
      {ta('outcome', 'Outcome')}
      {num('timesRevisited', 'Times Revisited')}
      {ta('notes', 'Notes')}
      <div className="col-span-2 flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  )
}

export default function DecisionsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<DraftDecision>(emptyDraft())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<Partial<Decision>>({})
  const [saving, setSaving] = useState(false)

  const enabled = !!orgId
  const { data: decisions = [] } = useQuery({
    queryKey: ['decisions', orgId, projectId],
    queryFn: () => listDecisions(orgId!, projectId),
    enabled,
  })

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const canEdit = user
    ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
    : false

  const inv = () => qc.invalidateQueries({ queryKey: ['decisions', orgId, projectId] })

  function startEdit(d: Decision) {
    setEditingId(d.id)
    setEditDraft({ ...d })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditDraft({})
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const updates = { ...editDraft }
    if (updates.status === 'decided' && !updates.dateDecided) {
      updates.dateDecided = todayStr()
    }
    await updateDecision(orgId!, projectId, id, updates)
    inv()
    setEditingId(null)
    setEditDraft({})
    setSaving(false)
  }

  function startAdd() {
    setDraft(emptyDraft())
    setAdding(true)
  }

  async function handleAdd() {
    setSaving(true)
    const seqId = String(decisions.length + 1).padStart(3, '0')
    await addDecision(orgId!, projectId, {
      ...draft,
      seqId,
      createdBy: user?.uid ?? '',
    } as Omit<Decision, 'id'>)
    inv()
    setDraft(emptyDraft())
    setAdding(false)
    setSaving(false)
  }

  const colSpan = canEdit ? 7 : 6

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Decision Log</h2>
        {canEdit && !adding && (
          <Button size="sm" onClick={startAdd}>+ New Decision</Button>
        )}
      </div>

      <SummaryBar decisions={decisions} />

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2 font-medium w-12">ID</th>
              <th className="text-left p-2 font-medium">Question</th>
              <th className="text-left p-2 font-medium w-24">Priority</th>
              <th className="text-left p-2 font-medium w-36">Status</th>
              <th className="text-left p-2 font-medium w-28">Due Date</th>
              <th className="text-left p-2 font-medium w-24">Days Until Due</th>
              {canEdit && <th className="w-24" />}
            </tr>
          </thead>
          <tbody>
            {decisions.map((d) =>
              editingId === d.id ? (
                <tr key={d.id} className="border-t">
                  <td colSpan={colSpan}>
                    <DecisionForm
                      value={editDraft as Decision}
                      onChange={(key, val) => setEditDraft((prev) => ({ ...prev, [key]: val }))}
                      onSave={() => saveEdit(d.id)}
                      onCancel={cancelEdit}
                      saving={saving}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={d.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-mono text-xs text-muted-foreground">{d.seqId}</td>
                  <td className="p-2 max-w-xs truncate">{d.question}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={PRIORITY_CLASS[d.priority] ?? ''}>
                      {d.priority}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className={STATUS_CLASS[d.status]}>
                      {STATUS_LABEL[d.status]}
                    </Badge>
                  </td>
                  <td className="p-2 font-mono text-xs">{d.dueDate || '—'}</td>
                  <td className="p-2">
                    {(() => {
                      const days = daysUntilDue(d)
                      if (days === null) return null
                      return (
                        <span className={`font-mono text-xs ${days < 0 ? 'text-red-600 font-semibold' : ''}`}>
                          {days}
                        </span>
                      )
                    })()}
                  </td>
                  {canEdit && (
                    <td className="p-2">
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => startEdit(d)}>Edit</Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteDecision(orgId!, projectId, d.id).then(inv)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ),
            )}

            {canEdit && adding && (
              <tr className="border-t">
                <td colSpan={colSpan}>
                  <DecisionForm
                    value={draft}
                    onChange={(key, val) =>
                      setDraft((prev) => ({ ...prev, [key]: val as never }))
                    }
                    onSave={handleAdd}
                    onCancel={() => {
                      setAdding(false)
                      setDraft(emptyDraft())
                    }}
                    saving={saving}
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {decisions.length === 0 && !adding && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No decisions yet.{canEdit ? ' Click "+ New Decision" to add one.' : ''}
          </p>
        )}
      </div>
    </div>
  )
}
