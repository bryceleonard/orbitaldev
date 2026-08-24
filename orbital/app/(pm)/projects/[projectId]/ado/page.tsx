'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'

export default function AdoBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: sprintCache, isLoading, refetch } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'sprint'],
    queryFn: () => getLatestCache(orgId!, projectId, 'sprint'),
    enabled: !!orgId,
  })

  const { data: backlogCache } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'backlog'],
    queryFn: () => getLatestCache(orgId!, projectId, 'backlog'),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!sprintCache && !backlogCache) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">ADO not configured. Add your ADO connection in the Overview tab, then sync.</p>
        <p className="text-xs text-muted-foreground">ADO sync is available after Plan 4 is implemented.</p>
      </div>
    )
  }

  const sprint = sprintCache?.payload as Record<string, unknown> | undefined
  const items = (sprint?.value as unknown[]) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">ADO Board — Active Sprint</h2>
        <div className="flex items-center gap-2">
          {sprintCache && <span className="text-xs text-muted-foreground">Last synced: {sprintCache.fetchedAt?.slice(0, 16) ?? '—'}</span>}
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['To Do', 'In Progress', 'Done'].map((col) => (
          <div key={col} className="border rounded-md p-3">
            <p className="font-medium text-sm mb-2">{col}</p>
            {items
              .filter((i: unknown) => (i as Record<string, unknown>)['state'] === col)
              .map((i: unknown, idx: number) => {
                const item = i as Record<string, unknown>
                return (
                  <div key={idx} className="text-xs border rounded p-2 mb-1 bg-muted/30">
                    {String(item['title'] ?? item['id'] ?? idx)}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
