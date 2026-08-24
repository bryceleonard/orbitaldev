'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { listHelpfulLinks } from '@/lib/firestore/helpful-links'
import { ExternalLink } from 'lucide-react'

export default function PortalLinksPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links', orgId, projectId],
    queryFn: () => listHelpfulLinks(orgId!, projectId),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-xl">
      <h2 className="font-semibold mb-4">Helpful Links</h2>
      {links.length === 0 && (
        <p className="text-muted-foreground text-sm">No links have been added yet.</p>
      )}
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
