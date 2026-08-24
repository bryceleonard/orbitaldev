'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'

const VISIBLE_STATES = ['In Progress', 'Done']

export default function PortalAdoPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const enabled = !!orgId

  const { data: sprintCache, isLoading: sprintLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'sprint'],
    queryFn: () => getLatestCache(orgId!, projectId, 'sprint'),
    enabled,
  })

  const { data: devPlanCache, isLoading: planLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'devplan'],
    queryFn: () => getLatestCache(orgId!, projectId, 'devplan'),
    enabled,
  })

  if (sprintLoading || planLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!sprintCache && !devPlanCache) {
    return <p className="text-muted-foreground">ADO data not yet available.</p>
  }

  const sprintItems = ((sprintCache?.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]
  const visibleItems = sprintItems.filter((i) => VISIBLE_STATES.includes(String(i['state'] ?? '')))

  const iterations = ((devPlanCache?.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-semibold mb-4">Active Sprint</h2>
        {visibleItems.length === 0 && (
          <p className="text-muted-foreground text-sm">No in-progress or completed stories in the current sprint.</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          {VISIBLE_STATES.map((col) => (
            <div key={col} className="border rounded-md p-4">
              <p className="font-medium text-sm mb-3">{col}</p>
              <div className="flex flex-col gap-2">
                {visibleItems
                  .filter((i) => i['state'] === col)
                  .map((i, idx) => (
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
