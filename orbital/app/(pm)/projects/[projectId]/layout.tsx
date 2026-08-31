'use client'
import { useParams } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { ProjectTabs } from '@/components/layout/project-tabs'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-8 pt-6 pb-0">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-xl font-semibold">{project?.name ?? '—'}</h1>
          <a
            href={`/portal/${projectId}`}
            target="_blank"
            rel="noopener noreferrer"
            title="View client portal"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
        <ProjectTabs projectId={projectId} trackerBoards={project?.trackerBoards ?? []} />
      </div>
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
