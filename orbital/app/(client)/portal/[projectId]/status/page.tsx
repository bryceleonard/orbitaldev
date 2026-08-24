'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listRisks } from '@/lib/firestore/risks'
import { listIssues } from '@/lib/firestore/issues'
import { listClientActions } from '@/lib/firestore/client-actions'
import { StatusBadge } from '@/components/status/status-badge'
import { Badge } from '@/components/ui/badge'

const SEVERITY_COLOR: Record<string, string> = {
  low: 'bg-blue-50 text-blue-700 border-blue-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-red-50 text-red-700 border-red-200',
}

function schedulePercent(sow: { startDate: string; endDate: string }): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))
}

export default function PortalStatusPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const enabled = !!orgId

  const { data: risks = [] } = useQuery({
    queryKey: ['risks', orgId, projectId],
    queryFn: () => listRisks(orgId!, projectId),
    enabled,
  })
  const { data: issues = [] } = useQuery({
    queryKey: ['issues', orgId, projectId],
    queryFn: () => listIssues(orgId!, projectId),
    enabled,
  })
  const { data: clientActions = [] } = useQuery({
    queryKey: ['clientActions', orgId, projectId],
    queryFn: () => listClientActions(orgId!, projectId),
    enabled,
  })

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const schedule = schedulePercent(project.sow)
  const openRisks = risks.filter((r) => r.status === 'open')
  const openIssues = issues.filter((i) => i.status === 'open')
  const unresolvedActions = clientActions.filter((a) => !a.resolved)

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      <section>
        <h2 className="font-semibold mb-4">Status Overview</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {(
            [
              { label: 'Schedule', field: 'scheduleStatus' },
              { label: 'Budget',   field: 'budgetStatus' },
              { label: 'Scope',    field: 'scopeStatus' },
            ] as const
          ).map(({ label, field }) => (
            <div key={field} className="border rounded-md p-3 flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <StatusBadge status={project.statusHeader[field]} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-md p-4">
            <p className="text-xs text-muted-foreground">Schedule</p>
            <p className="text-2xl font-semibold">{schedule}%</p>
            <p className="text-xs text-muted-foreground">days elapsed</p>
          </div>
          <div className="border rounded-md p-4">
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className="text-sm font-medium">{project.sow.startDate || '—'}</p>
            <p className="text-xs text-muted-foreground">to {project.sow.endDate || '—'}</p>
          </div>
          <div className="border rounded-md p-4">
            <p className="text-xs text-muted-foreground">Scope</p>
            <p className="text-2xl font-semibold">—</p>
            <p className="text-xs text-muted-foreground">from ADO (Plan 4)</p>
          </div>
        </div>
      </section>

      {unresolvedActions.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3">Action Required</h3>
          <ul className="flex flex-col gap-2">
            {unresolvedActions.map((a) => (
              <li key={a.id} className="border rounded-md px-4 py-3 text-sm">
                <p className="font-medium">{a.stakeholderName}</p>
                <p className="text-muted-foreground">{a.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {openRisks.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3">Open Risks</h3>
          <ul className="flex flex-col gap-2">
            {openRisks.map((r) => (
              <li key={r.id} className="border rounded-md px-4 py-3 text-sm flex items-start gap-3">
                <Badge variant="outline" className={SEVERITY_COLOR[r.severity]}>{r.severity}</Badge>
                <div>
                  <p className="font-medium">{r.title}</p>
                  {r.description && <p className="text-muted-foreground">{r.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {openIssues.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3">Open Issues</h3>
          <ul className="flex flex-col gap-2">
            {openIssues.map((i) => (
              <li key={i.id} className="border rounded-md px-4 py-3 text-sm flex items-start gap-3">
                <Badge variant="outline" className={SEVERITY_COLOR[i.severity]}>{i.severity}</Badge>
                <div>
                  <p className="font-medium">{i.title}</p>
                  {i.description && <p className="text-muted-foreground">{i.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unresolvedActions.length === 0 && openRisks.length === 0 && openIssues.length === 0 && (
        <p className="text-muted-foreground text-sm">No open items at this time.</p>
      )}
    </div>
  )
}
