'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { listFiles } from '@/lib/firestore/files'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default function PortalDocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: allFiles = [], isLoading } = useQuery({
    queryKey: ['files', orgId, projectId],
    queryFn: () => listFiles(orgId!, projectId),
    enabled: !!orgId,
  })

  const sharedFiles = allFiles.filter((f) => f.sharedWithClient)

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl">
      <h2 className="font-semibold mb-4">Shared Documents</h2>

      {sharedFiles.length === 0 && (
        <p className="text-muted-foreground text-sm">No documents have been shared with you yet.</p>
      )}

      <ul className="flex flex-col gap-3">
        {sharedFiles.map((f) => (
          <li key={f.id} className="flex items-center justify-between border rounded-md px-4 py-3">
            <div>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.mimeType} · {(f.sizeBytes / 1024).toFixed(0)} KB · {f.uploadedAt?.slice(0, 10) ?? '—'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(`/api/files/download/${projectId}/${f.id}`, '_blank')}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
