'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { updateProject } from '@/lib/firestore/projects'
import { listRisks, addRisk, updateRisk, deleteRisk } from '@/lib/firestore/risks'
import { listIssues, addIssue, updateIssue, deleteIssue } from '@/lib/firestore/issues'
import { listOnboardItems, addOnboardItem, updateOnboardItem, deleteOnboardItem } from '@/lib/firestore/onboard-items'
import { listClientActions, addClientAction, updateClientAction, deleteClientAction } from '@/lib/firestore/client-actions'
import { listStatusSnapshots, addStatusSnapshot } from '@/lib/firestore/status-snapshots'
import { CrudTable } from '@/components/tables/crud-table'
import { StatusBadge } from '@/components/status/status-badge'
import { SnapshotForm } from '@/components/status/snapshot-form'
import type { StatusLevel, Risk, Issue, OnboardItem, ClientAction } from '@/lib/types'

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

  const [budgetConsumed, setBudgetConsumed] = useState(0)

  const enabled = !!orgId
  const { data: risks = [] } = useQuery({ queryKey: ['risks', orgId, projectId], queryFn: () => listRisks(orgId!, projectId), enabled })
  const { data: issues = [] } = useQuery({ queryKey: ['issues', orgId, projectId], queryFn: () => listIssues(orgId!, projectId), enabled })
  const { data: onboardItems = [] } = useQuery({ queryKey: ['onboard', orgId, projectId], queryFn: () => listOnboardItems(orgId!, projectId), enabled })
  const { data: clientActions = [] } = useQuery({ queryKey: ['clientActions', orgId, projectId], queryFn: () => listClientActions(orgId!, projectId), enabled })
  const { data: snapshots = [] } = useQuery({ queryKey: ['snapshots', orgId, projectId], queryFn: () => listStatusSnapshots(orgId!, projectId), enabled })

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const canEdit = user ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor' : false
  const schedule = schedulePercent(project.sow)

  async function setStatus(field: 'scheduleStatus' | 'budgetStatus' | 'scopeStatus', value: StatusLevel) {
    if (!orgId) return
    await updateProject(orgId, projectId, {
      statusHeader: { ...project.statusHeader, [field]: value },
    })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
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
          {canEdit
            ? <input type="number" value={budgetConsumed} onChange={(e) => setBudgetConsumed(+e.target.value)} className="text-2xl font-semibold w-24 border-b focus:outline-none" />
            : <p className="text-2xl font-semibold">{budgetConsumed}</p>
          }
          <p className="text-xs text-muted-foreground">of {project.sow.budgetHours} hours</p>
        </div>
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Scope</p>
          <p className="text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">stories from ADO (Plan 4)</p>
        </div>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Onboard Items</h2>
        <CrudTable<OnboardItem>
          columns={[
            { key: 'item', label: 'Item', type: 'text' },
            { key: 'owner', label: 'Owner', type: 'text' },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'actionItems', label: 'Action Items', type: 'text' },
            { key: 'complete', label: 'Done', type: 'toggle' },
          ]}
          rows={onboardItems}
          canEdit={canEdit}
          onAdd={(d) => addOnboardItem(orgId!, projectId, d as Omit<OnboardItem, 'id'>).then(inv('onboard'))}
          onUpdate={(id, d) => updateOnboardItem(orgId!, projectId, id, d).then(inv('onboard'))}
          onDelete={(id) => deleteOnboardItem(orgId!, projectId, id).then(inv('onboard'))}
        />
      </section>

      <section>
        <h2 className="font-semibold mb-3">Risks</h2>
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
        <h2 className="font-semibold mb-3">Issues</h2>
        <CrudTable<Issue>
          columns={[
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'owner', label: 'Owner', type: 'text' },
            { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high'] },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['open', 'resolved'] },
          ]}
          rows={issues}
          canEdit={canEdit}
          onAdd={(d) => addIssue(orgId!, projectId, d as Omit<Issue, 'id'>).then(inv('issues'))}
          onUpdate={(id, d) => updateIssue(orgId!, projectId, id, d).then(inv('issues'))}
          onDelete={(id) => deleteIssue(orgId!, projectId, id).then(inv('issues'))}
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

      {canEdit && (
        <section>
          <h2 className="font-semibold mb-3">Status Snapshots</h2>
          <SnapshotForm
            project={project}
            budgetConsumed={budgetConsumed}
            onSave={(d) => addStatusSnapshot(orgId!, projectId, { ...d, createdBy: user!.uid }).then(inv('snapshots'))}
          />
          {snapshots.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {[...snapshots].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
                <li key={s.id} className="border rounded-md p-3 text-sm">
                  <p className="font-medium">{s.date} — Schedule {s.schedulePercent}% · Budget {s.budgetConsumed}h · Scope {s.scopeComplete}</p>
                  {s.notes && <p className="text-muted-foreground mt-1">{s.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
