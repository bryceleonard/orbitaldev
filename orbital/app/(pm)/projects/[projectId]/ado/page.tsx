'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function AdoBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { data: sprintCache, isLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'sprint'],
    queryFn: () => getLatestCache(orgId!, projectId, 'sprint'),
    enabled: !!orgId,
  })

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/ado/${projectId}?type=sprint&force=1`)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Sync failed')
      }
      qc.invalidateQueries({ queryKey: ['ado-cache', orgId, projectId, 'sprint'] })
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!sprintCache) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">ADO not configured or not yet synced.</p>
        <Button onClick={handleSync} disabled={syncing} className="self-start">
          {syncing ? 'Syncing…' : 'Sync from ADO'}
        </Button>
        {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      </div>
    )
  }

  const items = ((sprintCache.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">ADO Board — Active Sprint</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last synced: {sprintCache.fetchedAt?.slice(0, 16) ?? '—'}
          </span>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>
      </div>
      {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      <div className="grid grid-cols-3 gap-4">
        {['To Do', 'In Progress', 'Done'].map((col) => (
          <div key={col} className="border rounded-md p-3">
            <p className="font-medium text-sm mb-2">{col}</p>
            {items
              .filter((i) => i['state'] === col)
              .map((i, idx) => (
                <div key={idx} className="text-xs border rounded p-2 mb-1 bg-muted/30">
                  {String(i['title'] ?? idx)}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
