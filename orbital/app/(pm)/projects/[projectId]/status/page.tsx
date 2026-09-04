'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { updateProject } from '@/lib/firestore/projects'
import { listRisks, addRisk, updateRisk, deleteRisk } from '@/lib/firestore/risks'
import { listClientActions, addClientAction, updateClientAction, deleteClientAction } from '@/lib/firestore/client-actions'
import { CrudTable } from '@/components/tables/crud-table'
import { StatusBadge } from '@/components/status/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StatusLevel, Risk, ClientAction } from '@/lib/types'

const STATUS_OPTIONS: StatusLevel[] = ['on_track', 'at_risk', 'off_track']

function schedulePercent(sow: { startDate: string; endDate: string }): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))
}

export default function StatusPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const [hoursUsed, setHoursUsed] = useState(0)
  const [savingHours, setSavingHours] = useState(false)

  useEffect(() => {
    if (project) setHoursUsed(project.hoursUsed ?? 0)
  }, [project])

  const enabled = !!orgId
  const { data: risks = [] } = useQuery({ queryKey: ['risks', orgId, projectId], queryFn: () => listRisks(orgId!, projectId), enabled })
  const { data: clientActions = [] } = useQuery({ queryKey: ['clientActions', orgId, projectId], queryFn: () => listClientActions(orgId!, projectId), enabled })

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const canEdit = user ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor' : false
  const schedule = schedulePercent(project.sow)

  async function setStatus(field: 'scheduleStatus' | 'budgetStatus' | 'scopeStatus', value: StatusLevel) {
    if (!orgId || !project) return
    await updateProject(orgId, projectId, {
      statusHeader: { ...project.statusHeader, [field]: value },
    })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
  }

  async function saveHoursUsed() {
    if (!orgId) return
    setSavingHours(true)
    await updateProject(orgId, projectId, { hoursUsed })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
    setSavingHours(false)
  }

  const inv = (key: string) => () => qc.invalidateQueries({ queryKey: [key, orgId, projectId] })

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="font-semibold mb-4">Project Status</h2>
        <div className="grid grid-cols-3 gap-4">
          {(['scheduleStatus', 'budgetStatus', 'scopeStatus'] as const).map((field) => (
            <div key={field} className="border rounded-md p-4 flex flex-col gap-2">
              <p className="text-sm font-medium capitalize">{field.replace('Status', '')}</p>
              <StatusBadge status={project.statusHeader[field]} />
              {canEdit && (
                <select
                  value={project.statusHeader[field]}
                  onChange={(e) => setStatus(field, e.target.value as StatusLevel)}
                  className="text-xs border rounded px-2 py-1 mt-1"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-3 gap-4">
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Schedule</p>
          <p className="text-2xl font-semibold">{schedule}%</p>
          <p className="text-xs text-muted-foreground">days elapsed</p>
        </div>
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Budget consumed</p>
          <p className="text-2xl font-semibold">{hoursUsed} hrs</p>
          <p className="text-xs text-muted-foreground">
            {project.sow.totalHours
              ? `${Math.round((hoursUsed / project.sow.totalHours) * 100)}% of ${project.sow.totalHours} hrs`
              : 'No budget set'}
          </p>
        </div>
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Scope</p>
          <p className="text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">stories from ADO (Plan 4)</p>
        </div>
      </section>

      {canEdit && (
        <section>
          <h2 className="font-semibold mb-3">Hours Used</h2>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              className="w-40"
              value={hoursUsed || ''}
              onChange={(e) => setHoursUsed(e.target.value === '' ? 0 : +e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="0"
            />
            <span className="text-sm text-muted-foreground">cumulative hours billed to date</span>
            <Button onClick={saveHoursUsed} disabled={savingHours} size="sm">
              {savingHours ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-semibold mb-3">Risks and Issues</h2>
        <CrudTable<Risk>
          columns={[
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'owner', label: 'Owner', type: 'text' },
            { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high'] },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['open', 'resolved'] },
          ]}
          rows={risks}
          canEdit={canEdit}
          onAdd={(d) => addRisk(orgId!, projectId, d as Omit<Risk, 'id'>).then(inv('risks'))}
          onUpdate={(id, d) => updateRisk(orgId!, projectId, id, d).then(inv('risks'))}
          onDelete={(id) => deleteRisk(orgId!, projectId, id).then(inv('risks'))}
        />
      </section>

      <section>
        <h2 className="font-semibold mb-3">Need From Client</h2>
        <CrudTable<ClientAction>
          columns={[
            { key: 'stakeholderName', label: 'Stakeholder', type: 'text' },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'resolved', label: 'Resolved', type: 'toggle' },
          ]}
          rows={clientActions}
          canEdit={canEdit}
          onAdd={(d) => addClientAction(orgId!, projectId, d as Omit<ClientAction, 'id'>).then(inv('clientActions'))}
          onUpdate={(id, d) => updateClientAction(orgId!, projectId, id, d).then(inv('clientActions'))}
          onDelete={(id) => deleteClientAction(orgId!, projectId, id).then(inv('clientActions'))}
        />
      </section>

    </div>
  )
}
