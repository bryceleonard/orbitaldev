'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listResources } from '@/lib/firestore/resources'
import { listRisks } from '@/lib/firestore/risks'
import { listClientActions } from '@/lib/firestore/client-actions'
import { CircularProgress } from '@/components/ui/circular-progress'
import { StatusBadge } from '@/components/status/status-badge'
import { Badge } from '@/components/ui/badge'
import type { StatusLevel } from '@/lib/types'

function schedulePercent(sow: { startDate: string; endDate: string }): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  if (end - start <= 0) return 0
  return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))
}

function scheduleDays(sow: { startDate: string; endDate: string }): { elapsed: number; total: number } {
  if (!sow.startDate || !sow.endDate) return { elapsed: 0, total: 0 }
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  if (end - start <= 0) return { elapsed: 0, total: 0 }
  const now = Date.now()
  const total = Math.round((end - start) / 86_400_000)
  const elapsed = Math.min(total, Math.max(0, Math.round((now - start) / 86_400_000)))
  return { elapsed, total }
}

function budgetPercent(hoursConsumed: number, totalHours: number): number {
  if (!totalHours) return 0
  return Math.min(100, Math.round((hoursConsumed / totalHours) * 100))
}

const SEVERITY_COLOR: Record<string, string> = {
  low:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high:   'bg-red-500/10  text-red-400  border-red-500/20',
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-px w-7 bg-[#fad542]" />
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#fad542]">
        {children}
      </span>
    </div>
  )
}

export default function PortalOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const enabled = !!orgId

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', orgId, projectId],
    queryFn: () => listResources(orgId!, projectId),
    enabled,
  })
  const { data: risks = [] } = useQuery({
    queryKey: ['risks', orgId, projectId],
    queryFn: () => listRisks(orgId!, projectId),
    enabled,
  })
  const { data: clientActions = [] } = useQuery({
    queryKey: ['clientActions', orgId, projectId],
    queryFn: () => listClientActions(orgId!, projectId),
    enabled,
  })

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const schedulePct = schedulePercent(project.sow)
  const { elapsed: daysElapsed, total: totalDays } = scheduleDays(project.sow)
  const hoursConsumed = resources.reduce((sum, r) => sum + r.hours, 0)
  const budgetPct = budgetPercent(hoursConsumed, project.sow.totalHours)
  const openRisks = risks.filter((r) => r.status === 'open')
  const unresolvedActions = clientActions.filter((a) => !a.resolved)

  return (
    <div className="max-w-3xl flex flex-col gap-10">
      {/* Project header */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
          {project.description && (
            <p className="mt-1 text-muted-foreground">{project.description}</p>
          )}
        </div>
        {project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.techStack.map((t) => (
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
          </div>
        )}
        <p className="font-mono text-[11px] text-muted-foreground tracking-[0.08em]">
          {project.sow.startDate || '—'} → {project.sow.endDate || '—'}
        </p>
        {project.sow.summary && (
          <p className="text-sm text-muted-foreground">{project.sow.summary}</p>
        )}
      </section>

      {/* Metrics row */}
      <section>
        <SectionLabel>Health</SectionLabel>
        <div className="grid grid-cols-2 gap-6">
          <MetricCard
            label="Schedule"
            percent={schedulePct}
            status={project.statusHeader.scheduleStatus}
            centerLabel={`${schedulePct}%`}
            centerSub="elapsed"
            metricLine={`${daysElapsed} of ${totalDays} days`}
          />
          <MetricCard
            label="Budget"
            percent={budgetPct}
            status={project.statusHeader.budgetStatus}
            centerLabel={project.sow.totalHours ? `${budgetPct}%` : '—'}
            centerSub="of budget"
            metricLine={
              project.sow.totalHours
                ? `${hoursConsumed} of ${project.sow.totalHours} hrs`
                : 'No budget set'
            }
          />
        </div>
      </section>

      {/* Open risks */}
      <section>
        <SectionLabel>Open Risks</SectionLabel>
        {openRisks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open risks.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {openRisks.map((r) => (
              <li key={r.id} className="bg-card border rounded-md px-4 py-3 flex items-start gap-3">
                <Badge
                  variant="outline"
                  className={SEVERITY_COLOR[r.severity] ?? ''}
                >
                  {r.severity.toUpperCase()}
                </Badge>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.description && (
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions required */}
      {unresolvedActions.length > 0 && (
        <section>
          <SectionLabel>Action Required</SectionLabel>
          <ul className="flex flex-col gap-3">
            {unresolvedActions.map((a) => (
              <li key={a.id} className="bg-card border rounded-md px-4 py-3">
                <p className="text-sm font-medium">{a.stakeholderName}</p>
                <p className="text-sm text-muted-foreground">{a.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function MetricCard({
  label,
  percent,
  status,
  centerLabel,
  centerSub,
  metricLine,
}: {
  label: string
  percent: number
  status: StatusLevel
  centerLabel: string
  centerSub: string
  metricLine: string
}) {
  return (
    <div className="bg-card border rounded-md p-6 flex flex-col items-center gap-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground self-start">
        {label}
      </p>
      <CircularProgress percent={percent} status={status}>
        <span className="text-2xl font-bold leading-none">{centerLabel}</span>
        <span className="text-xs text-muted-foreground mt-1">{centerSub}</span>
      </CircularProgress>
      <StatusBadge status={status} />
      <p className="text-xs text-muted-foreground">{metricLine}</p>
    </div>
  )
}
