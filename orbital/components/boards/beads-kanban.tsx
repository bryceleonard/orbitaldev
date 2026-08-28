'use client'
import { useState } from 'react'
import type { BeadsIssue } from '@/lib/types'
import { BeadCard } from './bead-card'
import { BeadDetailDrawer } from './bead-detail-drawer'
import { statusLabel, catColor } from '@/lib/beads-view'
import { Button } from '@/components/ui/button'

const COLUMN_ORDER = ['open', 'in_progress', 'in_review', 'blocked', 'rework', 'deferred', 'pinned', 'closed']
const COLUMN_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  in_review: 'In Review',
  blocked: 'Blocked',
  rework: 'Rework',
  deferred: 'Deferred',
  pinned: 'Pinned',
  closed: 'Closed',
}

export function BeadsKanban({
  issues,
  fetchedAt,
  onSync,
  syncing,
  syncError,
}: {
  issues: BeadsIssue[]
  fetchedAt?: string
  onSync?: () => void
  syncing?: boolean
  syncError?: string | null
}) {
  const [selected, setSelected] = useState<BeadsIssue | null>(null)

  // Group by status, preserving COLUMN_ORDER then any extras
  const grouped = new Map<string, BeadsIssue[]>()
  for (const issue of issues) {
    const s = issue.status
    if (!grouped.has(s)) grouped.set(s, [])
    grouped.get(s)!.push(issue)
  }
  const orderedKeys = [
    ...COLUMN_ORDER,
    ...[...grouped.keys()].filter((k) => !COLUMN_ORDER.includes(k)),
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* top bar */}
      {(onSync || fetchedAt) && (
        <div className="flex items-center justify-between">
          {fetchedAt && (
            <span className="text-xs text-muted-foreground">Last synced: {fetchedAt.slice(0, 16)}</span>
          )}
          {onSync && (
            <Button variant="outline" size="sm" onClick={onSync} disabled={syncing} className="ml-auto">
              {syncing ? 'Syncing…' : 'Sync'}
            </Button>
          )}
        </div>
      )}
      {syncError && <p className="text-sm text-destructive">{syncError}</p>}

      {/* columns */}
      <div className="flex divide-x divide-border overflow-x-auto pb-4">
        {orderedKeys.map((status) => {
          const col = grouped.get(status) ?? []
          const label = COLUMN_LABELS[status] ?? statusLabel(status)
          return (
            <div key={status} className="flex min-w-[260px] max-w-[300px] flex-1 flex-col px-4 first:pl-0 last:pr-0">
              {/* column header — stays fixed above the scroll area */}
              <div className="flex items-center gap-2 px-1 pb-2 bg-background">
                <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: catColor(status) }} />
                <span className="text-sm font-medium">{label}</span>
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground font-medium">
                  {col.length}
                </span>
              </div>
              {/* cards — independently scrollable */}
              <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-220px)] pr-0.5">
                {col.map((issue) => (
                  <BeadCard key={issue.id} bead={issue} onClick={() => setSelected(issue)} />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <BeadDetailDrawer bead={selected} onClose={() => setSelected(null)} allIssues={issues} />
    </div>
  )
}
