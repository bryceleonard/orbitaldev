'use client'
import { useParams } from 'next/navigation'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { StatusBadge } from '@/components/status/status-badge'
import { Badge } from '@/components/ui/badge'

export default function PortalOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <section>
        <h2 className="text-2xl font-semibold">{project.name}</h2>
        {project.description && <p className="mt-2 text-muted-foreground">{project.description}</p>}
        {project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {project.techStack.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-3">Engagement Summary</h3>
        <div className="border rounded-md p-4 flex flex-col gap-2 text-sm">
          {project.sow.summary && <p>{project.sow.summary}</p>}
          <div className="grid grid-cols-2 gap-2 mt-2 text-muted-foreground">
            <span>Start: <strong className="text-foreground">{project.sow.startDate || '—'}</strong></span>
            <span>End: <strong className="text-foreground">{project.sow.endDate || '—'}</strong></span>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-3">Project Status</h3>
        <div className="grid grid-cols-3 gap-4">
          {(
            [
              { label: 'Schedule', field: 'scheduleStatus' },
              { label: 'Budget',   field: 'budgetStatus' },
              { label: 'Scope',    field: 'scopeStatus' },
            ] as const
          ).map(({ label, field }) => (
            <div key={field} className="border rounded-md p-4 flex flex-col gap-2">
              <p className="text-sm font-medium">{label}</p>
              <StatusBadge status={project.statusHeader[field]} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
