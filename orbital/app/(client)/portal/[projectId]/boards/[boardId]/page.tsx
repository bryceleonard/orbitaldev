'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { getLatestBoardCache } from '@/lib/firestore/ado-cache'
import type { BeadsIssue } from '@/lib/types'
import { BeadsKanban } from '@/components/boards/beads-kanban'

export default function PortalBoardPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const board = project?.trackerBoards.find((b) => b.id === boardId)

  if (!board) return <p className="text-muted-foreground">Loading…</p>
  if (board.type === 'beads') return <PortalBeadsView projectId={projectId} boardId={boardId} orgId={orgId} />
  return <PortalAdoView projectId={projectId} boardId={boardId} orgId={orgId} />
}

function PortalAdoView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const { data: sprintCache, isLoading: sl } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'sprint'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'sprint'),
    enabled: !!orgId,
  })
  const { data: devPlanCache, isLoading: dl } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'devplan'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'devplan'),
    enabled: !!orgId,
  })

  if (sl || dl) return <p className="text-muted-foreground">Loading…</p>
  if (!sprintCache && !devPlanCache) return <p className="text-muted-foreground">ADO data not yet available.</p>

  const VISIBLE = ['In Progress', 'Done']
  const sprintItems = ((sprintCache?.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]
  const visibleItems = sprintItems.filter((i) => VISIBLE.includes(String(i['state'] ?? '')))
  const iterations = ((devPlanCache?.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-semibold mb-4">Active Sprint</h2>
        {visibleItems.length === 0 && (
          <p className="text-muted-foreground text-sm">No in-progress or completed stories in the current sprint.</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          {VISIBLE.map((col) => (
            <div key={col} className="border rounded-md p-4">
              <p className="font-medium text-sm mb-3">{col}</p>
              <div className="flex flex-col gap-2">
                {visibleItems.filter((i) => i['state'] === col).map((i, idx) => (
                  <div key={idx} className="text-xs border rounded p-2 bg-muted/30">
                    {String(i['title'] ?? i['id'] ?? idx)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      {iterations.length > 0 && (
        <section>
          <h2 className="font-semibold mb-4">Development Plan</h2>
          <table className="w-full text-sm border rounded-md overflow-hidden">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Milestone</th>
                <th className="text-left p-2">Start</th>
                <th className="text-left p-2">Target</th>
              </tr>
            </thead>
            <tbody>
              {iterations.map((it, idx) => {
                const attrs = it['attributes'] as Record<string, unknown> | undefined
                return (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{String(it['name'] ?? idx)}</td>
                    <td className="p-2">{String(attrs?.['startDate'] ?? '—').slice(0, 10)}</td>
                    <td className="p-2">{String(attrs?.['finishDate'] ?? '—').slice(0, 10)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}

function PortalBeadsView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const { data: cache, isLoading } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'beads-issues'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'beads-issues'),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (!cache) return <p className="text-muted-foreground">Issue data not yet available.</p>

  const issues = Array.isArray(cache.payload) ? cache.payload as BeadsIssue[] : []
  return <BeadsKanban issues={issues} fetchedAt={cache.fetchedAt} />
}
