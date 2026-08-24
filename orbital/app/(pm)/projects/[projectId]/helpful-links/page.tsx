'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listHelpfulLinks, addHelpfulLink, updateHelpfulLink, deleteHelpfulLink } from '@/lib/firestore/helpful-links'
import { CrudTable } from '@/components/tables/crud-table'
import type { HelpfulLink } from '@/lib/types'

export default function HelpfulLinksPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)
  const { data: rows = [] } = useQuery({
    queryKey: ['links', orgId, projectId],
    queryFn: () => listHelpfulLinks(orgId!, projectId),
    enabled: !!orgId,
  })
  const canEdit = user && project ? project.members[user.uid] !== 'viewer' : false
  const inv = () => qc.invalidateQueries({ queryKey: ['links', orgId, projectId] })

  return (
    <div>
      <h2 className="font-semibold mb-4">Helpful Links</h2>
      <CrudTable<HelpfulLink>
        columns={[
          { key: 'label', label: 'Label', type: 'text' },
          { key: 'url', label: 'URL', type: 'text' },
        ]}
        rows={rows}
        canEdit={canEdit}
        onAdd={(d) => addHelpfulLink(orgId!, projectId, d as Omit<HelpfulLink, 'id'>).then(inv)}
        onUpdate={(id, d) => updateHelpfulLink(orgId!, projectId, id, d).then(inv)}
        onDelete={(id) => deleteHelpfulLink(orgId!, projectId, id).then(inv)}
      />
    </div>
  )
}
