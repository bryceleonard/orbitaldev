'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { listMilestones } from '@/lib/firestore/milestones'
import { MilestonesGantt } from '@/components/milestones/milestones-gantt'

export default function PortalMilestonesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['milestones', orgId, projectId],
    queryFn: () => listMilestones(orgId!, projectId),
    enabled: !!orgId,
  })

  if (isLoading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>
  }

  if (milestones.length === 0) {
    return <p className="text-muted-foreground text-sm">No milestones yet.</p>
  }

  return (
    <div>
      <h2 className="font-semibold mb-4">Milestones</h2>
      <MilestonesGantt milestones={milestones} showTooltips />
    </div>
  )
}
