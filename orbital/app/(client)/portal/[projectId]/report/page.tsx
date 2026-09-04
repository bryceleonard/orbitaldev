'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listRisks } from '@/lib/firestore/risks'
import { listMilestones } from '@/lib/firestore/milestones'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import type { StatusLevel, MilestoneStatus } from '@/lib/types'

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
  const total = Math.round((end - start) / 86_400_000)
  const elapsed = Math.min(total, Math.max(0, Math.round((Date.now() - start) / 86_400_000)))
  return { elapsed, total }
}

const STATUS_LABEL: Record<StatusLevel, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  off_track: 'Off Track',
}

const STATUS_BAR_COLOR: Record<StatusLevel, string> = {
  on_track: '#16a34a',
  at_risk: '#d97706',
  off_track: '#dc2626',
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
  not_started: 'bg-gray-100 text-gray-600 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  blocked:     'bg-red-100 text-red-800 border-red-200',
  completed:   'bg-green-100 text-green-800 border-green-200',
}

function MetricBlock({
  label, percent, status, detail,
}: {
  label: string
  percent: number
  status: StatusLevel
  detail: string
}) {
  const barColor = STATUS_BAR_COLOR[status]
  return (
    <div className="border border-gray-200 rounded-md p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
      <p className="text-4xl font-bold text-gray-900 mb-3">{percent}%</p>
      <div className="h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: barColor }} />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: barColor }}>{STATUS_LABEL[status]}</p>
      <p className="text-xs text-gray-500">{detail}</p>
    </div>
  )
}

export default function PortalReportPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const enabled = !!orgId

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

  if (!project) return <p className="text-gray-400 p-8">Loading…</p>

  const schedulePct = schedulePercent(project.sow)
  const { elapsed: daysElapsed, total: totalDays } = scheduleDays(project.sow)
  const hoursConsumed = project.hoursUsed ?? 0
  const budgetPct = project.sow.totalHours
    ? Math.min(100, Math.round((hoursConsumed / project.sow.totalHours) * 100))
    : 0
  const openRisks = risks.filter((r) => r.status === 'open')
  const sortedMilestones = [...milestones].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`@page { size: A4; margin: 12mm; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }`}</style>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Print button — hidden when printing */}
        <div className="print:hidden flex justify-end mb-6">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>

        {/* Header band */}
        <header className="flex items-center justify-between pb-4 mb-8 border-b border-gray-200">
          <span className="text-lg font-bold tracking-tight text-gray-900">FortyAU</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Project Status Report</span>
          <span className="text-sm text-gray-500">{generatedDate}</span>
        </header>

        {/* Project block */}
        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mb-3">{project.description}</p>
          )}
          {project.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {project.techStack.map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          )}
          <p className="font-mono text-xs text-gray-500 mb-2">
            {project.sow.startDate || '—'} → {project.sow.endDate || '—'}
          </p>
          {project.sow.summary && (
            <p className="text-sm text-gray-600">{project.sow.summary}</p>
          )}
        </section>

        {/* Metrics */}
        <section className="grid grid-cols-2 gap-6 mb-10">
          <MetricBlock
            label="Schedule"
            percent={schedulePct}
            status={project.statusHeader.scheduleStatus}
            detail={totalDays ? `${daysElapsed} of ${totalDays} days` : 'No dates set'}
          />
          <MetricBlock
            label="Budget"
            percent={budgetPct}
            status={project.statusHeader.budgetStatus}
            detail={project.sow.totalHours ? `${hoursConsumed} of ${project.sow.totalHours} hrs` : 'No budget set'}
          />
        </section>

        {/* Risks */}
        <section className="mb-10 break-before-page">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Risks</h3>
          {openRisks.length === 0 ? (
            <p className="text-sm text-gray-500">No open risks.</p>
          ) : (
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500 w-28">Severity</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Risk</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Description</th>
                </tr>
              </thead>
              <tbody>
                {openRisks.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={SEVERITY_COLOR[r.severity] ?? ''}>
                        {r.severity.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{r.title}</td>
                    <td className="px-4 py-2 text-gray-600">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Milestones */}
        {sortedMilestones.length > 0 && (
          <section className="mb-10 break-before-page">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Milestones</h3>
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Milestone</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Start</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">End</th>
                </tr>
              </thead>
              <tbody>
                {sortedMilestones.map((m, i) => (
                  <tr key={m.id} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 font-medium text-gray-900">{m.name}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={MILESTONE_STATUS_CLASS[m.status]}>
                        {MILESTONE_STATUS_LABEL[m.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{m.startDate}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{m.endDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Footer — visible only when printing */}
        <footer className="hidden print:block mt-12 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Confidential · Generated {generatedDate} · Orbital</p>
        </footer>
      </div>
    </div>
  )
}
