'use client'
import { useParams } from 'next/navigation'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { PortalProjectTabs } from '@/components/portal/portal-project-tabs'

export default function PortalProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)

  return (
    <div className="flex flex-col">
      <div className="border-b px-8 pt-6 pb-0">
        <h1 className="text-xl font-semibold mb-4">{project?.name ?? '—'}</h1>
        <PortalProjectTabs projectId={projectId} trackerBoards={project?.trackerBoards ?? []} />
      </div>
      <div className="p-8">{children}</div>
    </div>
  )
}
