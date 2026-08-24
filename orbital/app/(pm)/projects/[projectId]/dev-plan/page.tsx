'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function DevPlanPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { data: devPlanCache, isLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'devplan'],
    queryFn: () => getLatestCache(orgId!, projectId, 'devplan'),
    enabled: !!orgId,
  })

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/ado/${projectId}?type=devplan&force=1`)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Sync failed')
      }
      qc.invalidateQueries({ queryKey: ['ado-cache', orgId, projectId, 'devplan'] })
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!devPlanCache) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">Development plan not yet synced.</p>
        <Button onClick={handleSync} disabled={syncing} className="self-start">
          {syncing ? 'Syncing…' : 'Sync from ADO'}
        </Button>
        {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      </div>
    )
  }

  const iterations = ((devPlanCache.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Development Plan</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last synced: {devPlanCache.fetchedAt?.slice(0, 16) ?? '—'}
          </span>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>
      </div>
      {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      <table className="w-full text-sm border rounded-md overflow-hidden">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2">Iteration</th>
            <th className="text-left p-2">Start</th>
            <th className="text-left p-2">End</th>
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
    </div>
  )
}
