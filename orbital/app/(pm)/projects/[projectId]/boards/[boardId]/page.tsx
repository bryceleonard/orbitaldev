'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { getLatestBoardCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BeadsIssue } from '@/lib/types'

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

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Backlog',
}

const PRIORITY_COLORS: Record<number, string> = {
  0: 'bg-red-100 text-red-800',
  1: 'bg-orange-100 text-orange-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-blue-100 text-blue-800',
  4: 'bg-gray-100 text-gray-700',
}

function BeadsBoardView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [selected, setSelected] = useState<BeadsIssue | null>(null)
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')

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

  const allIssues: BeadsIssue[] = Array.isArray(cache?.payload) ? cache.payload as BeadsIssue[] : []

  const filtered = allIssues.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterPriority !== 'all' && String(i.priority) !== filterPriority) return false
    return true
  })

  const childIds = new Set(filtered.filter((i) => i.parentId).map((i) => i.parentId!))
  const epics = filtered.filter((i) => childIds.has(i.id))
  const epicIds = new Set(epics.map((e) => e.id))
  const orphans = filtered.filter((i) => !i.parentId && !epicIds.has(i.id))

  const allStatuses = [...new Set(allIssues.map((i) => i.status))].sort()

  return (
    <div className="flex gap-6">
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <select
              className="text-sm border rounded px-2 py-1"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className="text-sm border rounded px-2 py-1"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All priorities</option>
              {[0, 1, 2, 3, 4].map((p) => (
                <option key={p} value={String(p)}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
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
              {syncing ? 'Syncing…' : 'Sync from repo'}
            </Button>
          </div>
        )}
        {cache && (
          <table className="w-full text-sm border rounded-md overflow-hidden">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 w-24">ID</th>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2 w-20">Type</th>
                <th className="text-left p-2 w-24">Priority</th>
                <th className="text-left p-2 w-28">Status</th>
                <th className="text-left p-2 w-28">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {epics.map((epic) => {
                const children = filtered.filter((i) => i.parentId === epic.id)
                const closedCount = children.filter((i) => i.status === 'closed').length
                const expanded = expandedEpics.has(epic.id)
                return (
                  <Fragment key={epic.id}>
                    <tr
                      className="border-t bg-muted/20 cursor-pointer hover:bg-muted/40"
                      onClick={() => {
                        setExpandedEpics((prev) => {
                          const next = new Set(prev)
                          next.has(epic.id) ? next.delete(epic.id) : next.add(epic.id)
                          return next
                        })
                      }}
                    >
                      <td className="p-2 font-mono text-xs text-muted-foreground">{epic.id}</td>
                      <td className="p-2 font-medium">
                        <span className="mr-2">{expanded ? '▾' : '▸'}</span>
                        {epic.title}
                        <span className="ml-2 text-xs text-muted-foreground">{closedCount}/{children.length} closed</span>
                      </td>
                      <td className="p-2"><Badge variant="outline">{epic.type}</Badge></td>
                      <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[epic.priority])}>{PRIORITY_LABELS[epic.priority]}</span></td>
                      <td className="p-2"><Badge variant="outline">{epic.status}</Badge></td>
                      <td className="p-2 text-muted-foreground">{epic.assignee || '—'}</td>
                    </tr>
                    {expanded && children.map((child) => (
                      <tr
                        key={child.id}
                        className="border-t cursor-pointer hover:bg-muted/20"
                        onClick={() => setSelected(child)}
                      >
                        <td className="p-2 pl-6 font-mono text-xs text-muted-foreground">{child.id}</td>
                        <td className="p-2 pl-6">{child.title}</td>
                        <td className="p-2"><Badge variant="outline">{child.type}</Badge></td>
                        <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[child.priority])}>{PRIORITY_LABELS[child.priority]}</span></td>
                        <td className="p-2"><Badge variant="outline">{child.status}</Badge></td>
                        <td className="p-2 text-muted-foreground">{child.assignee || '—'}</td>
                      </tr>
                    ))}
                  </Fragment>
                )
              })}
              {orphans.map((issue) => (
                <tr
                  key={issue.id}
                  className="border-t cursor-pointer hover:bg-muted/20"
                  onClick={() => setSelected(issue)}
                >
                  <td className="p-2 font-mono text-xs text-muted-foreground">{issue.id}</td>
                  <td className="p-2">{issue.title}</td>
                  <td className="p-2"><Badge variant="outline">{issue.type}</Badge></td>
                  <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[issue.priority])}>{PRIORITY_LABELS[issue.priority]}</span></td>
                  <td className="p-2"><Badge variant="outline">{issue.status}</Badge></td>
                  <td className="p-2 text-muted-foreground">{issue.assignee || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <aside className="w-80 border rounded-md p-4 flex flex-col gap-3 shrink-0 self-start">
          <div className="flex items-start justify-between">
            <span className="font-mono text-xs text-muted-foreground">{selected.id}</span>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
          </div>
          <h3 className="font-semibold text-sm">{selected.title}</h3>
          {selected.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
            </div>
          )}
          {selected.acceptance_criteria && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Acceptance criteria</p>
              <p className="text-sm whitespace-pre-wrap">{selected.acceptance_criteria}</p>
            </div>
          )}
          {selected.dependencies.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Dependencies</p>
              <ul className="flex flex-col gap-1">
                {selected.dependencies.map((d) => (
                  <li key={d} className="font-mono text-xs">{d}</li>
                ))}
              </ul>
            </div>
          )}
          {selected.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.labels.map((l) => <Badge key={l} variant="outline">{l}</Badge>)}
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
