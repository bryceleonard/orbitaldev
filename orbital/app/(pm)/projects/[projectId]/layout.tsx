'use client'
import { useParams } from 'next/navigation'
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
        <h1 className="text-xl font-semibold mb-4">{project?.name ?? '—'}</h1>
        <ProjectTabs projectId={projectId} trackerBoards={project?.trackerBoards ?? []} />
      </div>
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
