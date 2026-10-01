'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listFiles, deleteFile } from '@/lib/firestore/files'
import { FileUploadButton } from '@/components/files/file-upload-button'
import { FileRow } from '@/components/files/file-row'
import { FileDrawer } from '@/components/files/file-drawer'
import type { ProjectFile } from '@/lib/types'

export default function FilesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)
  const [selected, setSelected] = useState<ProjectFile | null>(null)

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['files', orgId, projectId],
    queryFn: () => listFiles(orgId!, projectId),
    enabled: !!orgId,
    refetchInterval: (query) => {
      const data = query.state.data as ProjectFile[] | undefined
      return data?.some((f) => f.aiStatus === 'processing') ? 3000 : false
    },
  })

  const canEdit = user && project
    ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
    : false

  const inv = () => qc.invalidateQueries({ queryKey: ['files', orgId, projectId] })

  async function handleProcess(fileId: string) {
    if (!orgId) return
    try {
      const res = await fetch('/api/files/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, projectId, fileId }),
      })
      if (!res.ok) {
        console.error('[handleProcess] failed', res.status)
      }
    } catch (e) {
      console.error('[handleProcess] error', e)
    }
    inv()
  }

  async function handleDelete(fileId: string) {
    if (!orgId) return
    await deleteFile(orgId, projectId, fileId)
    if (selected?.id === fileId) setSelected(null)
    inv()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Context</h2>
        {canEdit && orgId && (
          <FileUploadButton orgId={orgId} projectId={projectId} onUploaded={inv} />
        )}
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
      {!isLoading && files.length === 0 && (
        <p className="text-muted-foreground text-sm">No files uploaded yet.</p>
      )}

      <div className="flex flex-col gap-2">
        {files.map((f) => (
          <FileRow
            key={f.id}
            file={f}
            canEdit={canEdit}
            onProcess={handleProcess}
            onSelect={setSelected}
            onDelete={handleDelete}
          />
        ))}
      </div>

      {selected && orgId && user && (
        <FileDrawer
          file={selected}
          orgId={orgId}
          projectId={projectId}
          uid={user.uid}
          onClose={() => setSelected(null)}
          onDraftsChanged={inv}
        />
      )}
    </div>
  )
}
