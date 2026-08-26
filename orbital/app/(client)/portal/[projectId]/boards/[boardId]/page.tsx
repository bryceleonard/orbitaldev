'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { getLatestBoardCache } from '@/lib/firestore/ado-cache'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BeadsIssue } from '@/lib/types'

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Backlog',
}
const PRIORITY_COLORS: Record<number, string> = {
  0: 'bg-red-100 text-red-800', 1: 'bg-orange-100 text-orange-800',
  2: 'bg-yellow-100 text-yellow-800', 3: 'bg-blue-100 text-blue-800',
  4: 'bg-gray-100 text-gray-700',
}

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
  const [selected, setSelected] = useState<BeadsIssue | null>(null)
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())

  const { data: cache, isLoading } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'beads-issues'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'beads-issues'),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (!cache) return <p className="text-muted-foreground">Issue data not yet available.</p>

  const allIssues: BeadsIssue[] = Array.isArray(cache.payload) ? cache.payload as BeadsIssue[] : []
  const childIds = new Set(allIssues.filter((i) => i.parentId).map((i) => i.parentId!))
  const epics = allIssues.filter((i) => childIds.has(i.id))
  const epicIds = new Set(epics.map((e) => e.id))
  const orphans = allIssues.filter((i) => !i.parentId && !epicIds.has(i.id))

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-4">Last synced: {cache.fetchedAt?.slice(0, 16) ?? '—'}</p>
        <table className="w-full text-sm border rounded-md overflow-hidden">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2 w-24">ID</th>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2 w-24">Priority</th>
              <th className="text-left p-2 w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {epics.map((epic) => {
              const children = allIssues.filter((i) => i.parentId === epic.id)
              const closed = children.filter((i) => i.status === 'closed').length
              const expanded = expandedEpics.has(epic.id)
              return (
                <>
                  <tr
                    key={epic.id}
                    className="border-t bg-muted/20 cursor-pointer hover:bg-muted/40"
                    onClick={() => setExpandedEpics((prev) => { const n = new Set(prev); n.has(epic.id) ? n.delete(epic.id) : n.add(epic.id); return n })}
                  >
                    <td className="p-2 font-mono text-xs text-muted-foreground">{epic.id}</td>
                    <td className="p-2 font-medium">
                      <span className="mr-2">{expanded ? '▾' : '▸'}</span>
                      {epic.title}
                      <span className="ml-2 text-xs text-muted-foreground">{closed}/{children.length} closed</span>
                    </td>
                    <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[epic.priority])}>{PRIORITY_LABELS[epic.priority]}</span></td>
                    <td className="p-2"><Badge variant="outline">{epic.status}</Badge></td>
                  </tr>
                  {expanded && children.map((child) => (
                    <tr key={child.id} className="border-t cursor-pointer hover:bg-muted/20" onClick={() => setSelected(child)}>
                      <td className="p-2 pl-6 font-mono text-xs text-muted-foreground">{child.id}</td>
                      <td className="p-2 pl-6">{child.title}</td>
                      <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[child.priority])}>{PRIORITY_LABELS[child.priority]}</span></td>
                      <td className="p-2"><Badge variant="outline">{child.status}</Badge></td>
                    </tr>
                  ))}
                </>
              )
            })}
            {orphans.map((issue) => (
              <tr key={issue.id} className="border-t cursor-pointer hover:bg-muted/20" onClick={() => setSelected(issue)}>
                <td className="p-2 font-mono text-xs text-muted-foreground">{issue.id}</td>
                <td className="p-2">{issue.title}</td>
                <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[issue.priority])}>{PRIORITY_LABELS[issue.priority]}</span></td>
                <td className="p-2"><Badge variant="outline">{issue.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <aside className="w-72 border rounded-md p-4 flex flex-col gap-3 shrink-0 self-start">
          <div className="flex items-start justify-between">
            <span className="font-mono text-xs text-muted-foreground">{selected.id}</span>
            <button onClick={() => setSelected(null)} className="text-muted-foreground text-sm">✕</button>
          </div>
          <h3 className="font-semibold text-sm">{selected.title}</h3>
          {selected.description && <p className="text-sm whitespace-pre-wrap">{selected.description}</p>}
        </aside>
      )}
    </div>
  )
}
