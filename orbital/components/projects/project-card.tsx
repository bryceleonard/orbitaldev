import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Project } from '@/lib/types'

interface Props { project: Project }

export function ProjectCard({ project }: Props) {
  const memberCount = Object.keys(project.members).length
  return (
    <Link href={`/projects/${project.id}/overview`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{project.name}</CardTitle>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">{project.description || 'No description'}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {memberCount} member{memberCount !== 1 ? 's' : ''} · Updated {project.updatedAt?.slice(0, 10) ?? '—'}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
