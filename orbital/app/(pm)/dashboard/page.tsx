'use client'
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

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', orgId, user?.uid],
    queryFn: () => listProjects(orgId!, user!.uid),
    enabled: !!orgId && !!user,
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button asChild>
          <Link href="/projects/new"><Plus className="h-4 w-4 mr-2" />New project</Link>
        </Button>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && projects.length === 0 && (
        <p className="text-muted-foreground">No projects yet. Create your first one.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>
    </div>
  )
}
