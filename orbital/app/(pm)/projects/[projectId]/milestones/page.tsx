'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listMilestones, addMilestone, updateMilestone, updateMilestoneStatus, deleteMilestone } from '@/lib/firestore/milestones'
import { MilestonesManager } from '@/components/milestones/milestones-manager'
import { MilestonesGantt } from '@/components/milestones/milestones-gantt'
import type { Milestone, MilestoneStatus } from '@/lib/types'

export default function MilestonesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', orgId, projectId],
    queryFn: () => listMilestones(orgId!, projectId),
    enabled: !!orgId,
  })

  const canEdit = user && project ? project.members[user.uid] !== 'viewer' : false

  const inv = () => qc.invalidateQueries({ queryKey: ['milestones', orgId, projectId] })

  async function handleAdd(data: { name: string; startDate: string; endDate: string }) {
    await addMilestone(orgId!, projectId, { ...data, createdBy: user!.uid })
    await inv()
  }

  async function handleStatusChange(milestone: Milestone, newStatus: MilestoneStatus) {
    await updateMilestoneStatus(orgId!, projectId, milestone.id, milestone.status, newStatus)
    await inv()
  }

  async function handleUpdate(id: string, data: { name: string; startDate: string; endDate: string }) {
    await updateMilestone(orgId!, projectId, id, data)
    await inv()
  }

  async function handleDelete(id: string) {
    await deleteMilestone(orgId!, projectId, id)
    await inv()
  }

  return (
    <div className="flex flex-col gap-8">
      {milestones.length > 0 && (
        <div>
          <h2 className="font-semibold mb-4">Timeline</h2>
          <MilestonesGantt milestones={milestones} />
        </div>
      )}

      <MilestonesManager
        milestones={milestones}
        canEdit={canEdit}
        onAdd={handleAdd}
        onStatusChange={handleStatusChange}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  )
}
