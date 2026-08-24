'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'

export default function DevPlanPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: devPlanCache, isLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'devplan'],
    queryFn: () => getLatestCache(orgId!, projectId, 'devplan'),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!devPlanCache) {
    return <p className="text-muted-foreground">Development plan data not available. Configure ADO in the Overview tab.</p>
  }

  const iterations = (devPlanCache.payload?.value as unknown[]) ?? []

  return (
    <div>
      <h2 className="font-semibold mb-4">Development Plan</h2>
      <table className="w-full text-sm border rounded-md overflow-hidden">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2">Iteration</th>
            <th className="text-left p-2">Start</th>
            <th className="text-left p-2">End</th>
            <th className="text-left p-2">Stories</th>
          </tr>
        </thead>
        <tbody>
          {iterations.map((it: unknown, idx: number) => {
            const iter = it as Record<string, unknown>
            const attrs = iter['attributes'] as Record<string, unknown> | undefined
            return (
              <tr key={idx} className="border-t">
                <td className="p-2">{String(iter['name'] ?? idx)}</td>
                <td className="p-2">{String(attrs?.['startDate'] ?? '—').slice(0, 10)}</td>
                <td className="p-2">{String(attrs?.['finishDate'] ?? '—').slice(0, 10)}</td>
                <td className="p-2">{String(iter['storyCount'] ?? '—')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
