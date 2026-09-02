'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listResources } from '@/lib/firestore/resources'
import { listRisks } from '@/lib/firestore/risks'
import { listMilestones } from '@/lib/firestore/milestones'
import { getLatestBoardCache } from '@/lib/firestore/ado-cache'
import { CircularProgress } from '@/components/ui/circular-progress'
import { StatusBadge } from '@/components/status/status-badge'
import { MilestonesGantt } from '@/components/milestones/milestones-gantt'
import { BeadsVelocity } from '@/components/boards/beads-velocity'
import { Badge } from '@/components/ui/badge'
import type { StatusLevel, MilestoneStatus, BeadsIssue } from '@/lib/types'

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
  low:    'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high:   'bg-red-100 text-red-800 border-red-200',
}

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  completed:   'Completed',
}

const MILESTONE_STATUS_CLASS: Record<MilestoneStatus, string> = {
  not_started: 'bg-muted text-muted-foreground border-border',
  in_progress: 'bg-primary/10 text-primary border-primary/20',
  blocked:     'bg-destructive/10 text-destructive border-destructive/20',
  completed:   'bg-green-100 text-green-800 border-green-200',
}

const WIP_STATUSES = new Set(['in_progress', 'in_review', 'rework', 'blocked'])
const QUEUED_STATUSES = new Set(['open', 'pinned', 'deferred'])

function SectionLabel({ children }: { children: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
      {children}
    </h3>
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
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', orgId, projectId],
    queryFn: () => listMilestones(orgId!, projectId),
    enabled,
  })

  const beadsBoard = project?.trackerBoards.find((b) => b.type === 'beads')
  const { data: beadsCache } = useQuery({
    queryKey: ['board-cache', orgId, projectId, beadsBoard?.id, 'beads-issues'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, beadsBoard!.id, 'beads-issues'),
    enabled: !!orgId && !!beadsBoard,
  })
  const beadsIssues: BeadsIssue[] = Array.isArray(beadsCache?.payload) ? (beadsCache.payload as BeadsIssue[]) : []

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const schedulePct = schedulePercent(project.sow)
  const { elapsed: daysElapsed, total: totalDays } = scheduleDays(project.sow)
  const hoursConsumed = resources.reduce((sum, r) => sum + r.hours, 0)
  const budgetPct = budgetPercent(hoursConsumed, project.sow.totalHours)
  const openRisks = risks.filter((r) => r.status === 'open')
  const sortedMilestones = [...milestones].sort((a, b) => a.startDate.localeCompare(b.startDate))

  const inProgressCount = beadsIssues.filter((i) => WIP_STATUSES.has(i.status)).length
  const queuedCount = beadsIssues.filter((i) => QUEUED_STATUSES.has(i.status)).length
  const completedCount = beadsIssues.filter((i) => i.status === 'closed').length
  const hasBeadsData = beadsIssues.length > 0

  return (
    <div className="flex flex-col gap-8 max-w-7xl">
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

      {/* Two-column layout */}
      <div className="grid grid-cols-[7fr_3fr] gap-8 items-start">
        {/* Left column — Health + Risks + Milestones */}
        <div className="flex flex-col gap-8">
          {/* Health metrics */}
          <section>
            <SectionLabel>Health</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
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

          {/* Risks */}
          <section>
            <SectionLabel>Risks</SectionLabel>
            <div className="bg-card border rounded-md p-6">
              {openRisks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No open risks.</p>
              ) : (
                <ul className="flex flex-col gap-3 max-h-64 overflow-y-auto pr-1">
                  {openRisks.map((r) => (
                    <li key={r.id} className="flex items-start gap-2">
                      <Badge
                        variant="outline"
                        className={`shrink-0 ${SEVERITY_COLOR[r.severity] ?? ''}`}
                      >
                        {r.severity.toUpperCase()}
                      </Badge>
                      <div>
                        <p className="text-sm font-medium leading-snug">{r.title}</p>
                        {r.description && (
                          <p className="text-xs text-muted-foreground">{r.description}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Milestones */}
          {milestones.length > 0 && (
            <section>
              <SectionLabel>Milestones</SectionLabel>
              <div className="flex flex-col gap-6">
                <MilestonesGantt milestones={milestones} showTooltips />
                <table className="w-full text-sm border rounded-md overflow-hidden">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Milestone</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Status</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">Start</th>
                      <th className="text-left px-4 py-2 font-medium text-muted-foreground">End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedMilestones.map((m, i) => (
                      <tr key={m.id} className={i % 2 === 0 ? '' : 'bg-muted/20'}>
                        <td className="px-4 py-2 font-medium">{m.name}</td>
                        <td className="px-4 py-2">
                          <Badge variant="outline" className={MILESTONE_STATUS_CLASS[m.status]}>
                            {MILESTONE_STATUS_LABEL[m.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{m.startDate}</td>
                        <td className="px-4 py-2 text-muted-foreground font-mono text-xs">{m.endDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* Right column — Velocity + Bead counts */}
        {hasBeadsData && (
          <div className="flex flex-col gap-6">
            <BeadsVelocity issues={beadsIssues} maxWeeks={4} />

            <section>
              <SectionLabel>Work Items</SectionLabel>
              <div className="flex flex-col gap-3">
                <BeadStatCard label="In Progress" count={inProgressCount} />
                <BeadStatCard label="Queued" count={queuedCount} />
                <BeadStatCard label="Completed" count={completedCount} />
              </div>
            </section>
          </div>
        )}
      </div>
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

function BeadStatCard({ label, count }: { label: string; count: number }) {
  return (
    <div className="bg-card border rounded-md px-4 py-3 flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      <span className="text-xl font-bold tabular-nums">{count}</span>
    </div>
  )
}
