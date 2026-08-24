'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listStakeholders, addStakeholder, updateStakeholder, deleteStakeholder } from '@/lib/firestore/stakeholders'
import { CrudTable } from '@/components/tables/crud-table'
import type { Stakeholder } from '@/lib/types'

export default function StakeholdersPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)
  const { data: rows = [] } = useQuery({
    queryKey: ['stakeholders', orgId, projectId],
    queryFn: () => listStakeholders(orgId!, projectId),
    enabled: !!orgId,
  })
  const canEdit = user && project ? project.members[user.uid] !== 'viewer' : false
  const inv = () => qc.invalidateQueries({ queryKey: ['stakeholders', orgId, projectId] })

  return (
    <div>
      <h2 className="font-semibold mb-4">Stakeholders</h2>
      <CrudTable<Stakeholder>
        columns={[
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'role', label: 'Role', type: 'text' },
          { key: 'responsibilities', label: 'Responsibilities', type: 'text' },
        ]}
        rows={rows}
        canEdit={canEdit}
        onAdd={(d) => addStakeholder(orgId!, projectId, d as Omit<Stakeholder, 'id'>).then(inv)}
        onUpdate={(id, d) => updateStakeholder(orgId!, projectId, id, d).then(inv)}
        onDelete={(id) => deleteStakeholder(orgId!, projectId, id).then(inv)}
      />
    </div>
  )
}
