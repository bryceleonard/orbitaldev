'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Project, StatusSnapshot } from '@/lib/types'

interface Props {
  project: Project
  budgetConsumed: number
  onSave: (data: Omit<StatusSnapshot, 'id'>) => Promise<void>
}

function schedulePercent(sow: Project['sow']): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  const now = Date.now()
  return Math.min(100, Math.round(((now - start) / (end - start)) * 100))
}

export function SnapshotForm({ project, budgetConsumed, onSave }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [scopeComplete, setScopeComplete] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave({
      date,
      schedulePercent: schedulePercent(project.sow),
      budgetConsumed,
      scopeComplete,
      notes,
      adoCacheRef: '',
      createdBy: '',
      createdAt: new Date().toISOString(),
    })
    setNotes('')
    setSaving(false)
  }

  return (
    <div className="border rounded-md p-4 flex flex-col gap-3 bg-muted/20">
      <h3 className="font-medium">Capture snapshot</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Meeting date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label>Scope complete (e.g. 159 / 231)</Label><Input value={scopeComplete} onChange={(e) => setScopeComplete(e.target.value)} placeholder="159 / 231" /></div>
      </div>
      <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button onClick={handleSave} disabled={saving} className="self-start">
        {saving ? 'Saving…' : 'Save snapshot'}
      </Button>
    </div>
  )
}
