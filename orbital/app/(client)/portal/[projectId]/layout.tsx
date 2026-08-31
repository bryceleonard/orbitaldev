'use client'
import { useParams } from 'next/navigation'
import { Printer } from 'lucide-react'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { PortalProjectTabs } from '@/components/portal/portal-project-tabs'

export default function PortalProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)

  return (
    <div className="flex flex-col">
      <div className="border-b px-8 pt-6 pb-0 print:hidden">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">{project?.name ?? '—'}</h1>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Printer className="h-4 w-4" />
            Export PDF
          </button>
        </div>
        <PortalProjectTabs projectId={projectId} trackerBoards={project?.trackerBoards ?? []} />
      </div>
      <div className="p-8 print:p-0">
        <div className="hidden print:block mb-6">
          <p className="text-xs text-muted-foreground">Orbital — Client Portal</p>
          <h1 className="text-2xl font-semibold">{project?.name ?? '—'}</h1>
        </div>
        {children}
      </div>
    </div>
  )
}
