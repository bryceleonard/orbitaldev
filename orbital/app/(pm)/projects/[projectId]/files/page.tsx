'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listFiles, updateFileShared, deleteFile } from '@/lib/firestore/files'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'

export default function FilesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const { data: files = [] } = useQuery({
    queryKey: ['files', orgId, projectId],
    queryFn: () => listFiles(orgId!, projectId),
    enabled: !!orgId,
  })

  const canEdit = user && project
    ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
    : false

  const inv = () => qc.invalidateQueries({ queryKey: ['files', orgId, projectId] })

  async function toggleShare(id: string, current: boolean) {
    if (!orgId) return
    await updateFileShared(orgId, projectId, id, !current)
    inv()
  }

  async function handleDelete(id: string) {
    if (!orgId) return
    await deleteFile(orgId, projectId, id)
    inv()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Context Files</h2>
        {canEdit && (
          <Button disabled title="Upload wired in Plan 4">Upload file</Button>
        )}
      </div>

      {files.length === 0 && <p className="text-muted-foreground text-sm">No files uploaded yet.</p>}

      <div className="flex flex-col gap-2">
        {files.map((f) => (
          <div key={f.id} className="flex items-center justify-between border rounded-md px-4 py-3">
            <div>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {(f.sizeBytes / 1024).toFixed(0)} KB · {f.uploadedAt?.slice(0, 10) ?? '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {f.sharedWithClient
                ? <Badge variant="outline" className="text-green-700 border-green-300">Shared</Badge>
                : <Badge variant="outline" className="text-muted-foreground">Internal</Badge>
              }
              {canEdit && (
                <>
                  <Button variant="outline" size="sm" onClick={() => toggleShare(f.id, f.sharedWithClient)}>
                    {f.sharedWithClient ? 'Unshare' : 'Share'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
