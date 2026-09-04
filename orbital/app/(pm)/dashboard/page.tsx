'use client'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { listProjects } from '@/lib/firestore/projects'
import { ProjectCard } from '@/components/projects/project-card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()
  const orgId = useOrgId()
  const [showArchived, setShowArchived] = useState(false)

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ['projects', orgId, user?.uid],
    queryFn: () => listProjects(orgId!, user!.uid),
    enabled: !!orgId && !!user,
  })

  const visible = projects.filter((p) => showArchived ? p.status === 'archived' : p.status !== 'archived')

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {showArchived ? '← Active projects' : `Archived (${projects.filter((p) => p.status === 'archived').length})`}
          </button>
        </div>
        {!showArchived && (
          <Button render={<Link href="/projects/new" />} nativeButton={false}>
            <Plus className="h-4 w-4 mr-2" />New project
          </Button>
        )}
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {error && <p className="text-sm text-destructive">{String(error)}</p>}
      {!isLoading && !error && visible.length === 0 && (
        <p className="text-muted-foreground">
          {showArchived ? 'No archived projects.' : 'No projects yet. Create your first one.'}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>
    </div>
  )
}
