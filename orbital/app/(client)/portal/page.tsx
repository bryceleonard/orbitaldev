'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { listProjects } from '@/lib/firestore/projects'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function PortalSelectorPage() {
  const { user } = useAuth()
  const orgId = useOrgId()
  const router = useRouter()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['portal-projects', orgId, user?.uid],
    queryFn: () => listProjects(orgId!, user!.uid),
    enabled: !!orgId && !!user,
  })

  useEffect(() => {
    if (!isLoading && projects.length === 1) {
      router.replace(`/portal/${projects[0].id}/overview`)
    }
  }, [isLoading, projects, router])

  if (isLoading || projects.length === 1) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You have not been added to any projects yet.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Your Projects</h1>
      <div className="flex flex-col gap-3">
        {projects.map((p) => (
          <Card
            key={p.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/portal/${p.id}/overview`)}
          >
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
              <CardDescription>{p.description || 'No description'}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
