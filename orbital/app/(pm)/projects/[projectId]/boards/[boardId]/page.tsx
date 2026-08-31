'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { getLatestBoardCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BeadsIssue } from '@/lib/types'
import { BeadsStatusView } from '@/components/boards/beads-status-view'

export default function BoardPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const board = project?.trackerBoards.find((b) => b.id === boardId)

  if (!board) return <p className="text-muted-foreground">Loading…</p>
  if (board.type === 'beads') return <BeadsBoardView projectId={projectId} boardId={boardId} orgId={orgId} />
  return <AdoBoardView projectId={projectId} boardId={boardId} orgId={orgId} />
}

// ── ADO Board ────────────────────────────────────────────────────────────────

type AdoSubTab = 'sprint' | 'devplan'

function AdoBoardView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const qc = useQueryClient()
  const [subTab, setSubTab] = useState<AdoSubTab>('sprint')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { data: cache, isLoading } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, subTab],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, subTab === 'sprint' ? 'sprint' : 'devplan'),
    enabled: !!orgId,
  })

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/boards/${projectId}/${boardId}?type=${subTab}&force=1`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Sync failed')
      qc.invalidateQueries({ queryKey: ['board-cache', orgId, projectId, boardId, subTab] })
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['sprint', 'devplan'] as AdoSubTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={cn(
                'px-3 py-1 text-sm rounded-md border',
                subTab === t ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground',
              )}
            >
              {t === 'sprint' ? 'Sprint Board' : 'Dev Plan'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {cache && <span className="text-xs text-muted-foreground">Last synced: {cache.fetchedAt?.slice(0, 16) ?? '—'}</span>}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>
      </div>
      {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && !cache && (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground">Not yet synced.</p>
          <Button onClick={handleSync} disabled={syncing} className="self-start">
            {syncing ? 'Syncing…' : `Sync from ADO`}
          </Button>
        </div>
      )}
      {cache && subTab === 'sprint' && <AdoSprintView cache={cache.payload} />}
      {cache && subTab === 'devplan' && <AdoDevPlanView cache={cache.payload} />}
    </div>
  )
}

function AdoSprintView({ cache }: { cache: Record<string, unknown> }) {
  const items = ((cache?.value as unknown[]) ?? []) as Record<string, unknown>[]
  return (
    <div className="grid grid-cols-3 gap-4">
      {['To Do', 'In Progress', 'Done'].map((col) => (
        <div key={col} className="border rounded-md p-3">
          <p className="font-medium text-sm mb-2">{col}</p>
          {items.filter((i) => i['state'] === col).map((i, idx) => (
            <div key={idx} className="text-xs border rounded p-2 mb-1 bg-muted/30">
              {String(i['title'] ?? idx)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function AdoDevPlanView({ cache }: { cache: Record<string, unknown> }) {
  const iterations = ((cache?.value as unknown[]) ?? []) as Record<string, unknown>[]
  return (
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
  )
}

// ── Beads Board ──────────────────────────────────────────────────────────────

function BeadsBoardView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { data: cache, isLoading } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'beads-issues'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'beads-issues'),
    enabled: !!orgId,
  })

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/boards/${projectId}/${boardId}?force=1`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Sync failed')
      qc.invalidateQueries({ queryKey: ['board-cache', orgId, projectId, boardId, 'beads-issues'] })
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (!cache) return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground">Not yet synced.</p>
      <button onClick={handleSync} disabled={syncing} className="self-start text-sm underline text-primary">
        {syncing ? 'Syncing…' : 'Sync from repo'}
      </button>
    </div>
  )

  const issues = Array.isArray(cache.payload) ? cache.payload as BeadsIssue[] : []
  return (
    <BeadsStatusView
      issues={issues}
      fetchedAt={cache.fetchedAt}
      onSync={handleSync}
      syncing={syncing}
      syncError={syncError}
    />
  )
}
