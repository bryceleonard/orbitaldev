'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listRoadmapItems, addRoadmapItem, updateRoadmapItem, deleteRoadmapItem } from '@/lib/firestore/roadmap-items'
import { CrudTable } from '@/components/tables/crud-table'
import type { RoadmapItem } from '@/lib/types'

export default function RoadmapPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)
  const { data: rows = [] } = useQuery({
    queryKey: ['roadmap', orgId, projectId],
    queryFn: () => listRoadmapItems(orgId!, projectId),
    enabled: !!orgId,
  })
  const canEdit = user && project ? project.members[user.uid] !== 'viewer' : false
  const inv = () => qc.invalidateQueries({ queryKey: ['roadmap', orgId, projectId] })

  return (
    <div>
      <h2 className="font-semibold mb-4">Roadmap</h2>
      <CrudTable<RoadmapItem>
        columns={[
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'targetDate', label: 'Target Date', type: 'text' },
        ]}
        rows={rows}
        canEdit={canEdit}
        onAdd={(d) => addRoadmapItem(orgId!, projectId, d as Omit<RoadmapItem, 'id'>).then(inv)}
        onUpdate={(id, d) => updateRoadmapItem(orgId!, projectId, id, d).then(inv)}
        onDelete={(id) => deleteRoadmapItem(orgId!, projectId, id).then(inv)}
      />
    </div>
  )
}
