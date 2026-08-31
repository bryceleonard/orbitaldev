'use client'

import { useState } from 'react'
import type { BeadsIssue } from '@/lib/types'
import {
  category,
  epicProgress,
  childrenOf,
  relTime,
  avatarColor,
  initials,
} from '@/lib/beads-view'
import { BeadDetailDrawer } from './bead-detail-drawer'
import { BeadsVelocity } from './beads-velocity'
import { Button } from '@/components/ui/button'

function Avatar({ name }: { name: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold text-white flex-shrink-0"
      style={{ background: avatarColor(name) }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide flex-shrink-0">
      {type}
    </span>
  )
}

function BeadRow({ bead, onClick }: { bead: BeadsIssue; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors text-left"
    >
      <span className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{bead.title}</span>
        <span className="text-xs text-muted-foreground">{bead.id}</span>
      </span>
      <TypeBadge type={bead.issue_type ?? bead.type ?? 'task'} />
      {bead.assignee && <Avatar name={bead.assignee} />}
      {bead.updated_at && (
        <span className="text-xs text-muted-foreground whitespace-nowrap w-16 text-right">
          {relTime(bead.updated_at)}
        </span>
      )}
    </button>
  )
}

function Section({
  title,
  count,
  children,
  accent,
}: {
  title: string
  count: number
  children: React.ReactNode
  accent?: string
}) {
  return (
    <section>
      <h2
        className="text-xs font-semibold uppercase tracking-widest mb-3"
        style={{ color: accent ?? 'var(--muted-foreground)' }}
      >
        {title}{' '}
        <span style={{ color: 'var(--foreground)' }}>{count}</span>
      </h2>
      <div className="rounded-lg border divide-y divide-border">{children}</div>
    </section>
  )
}

export function BeadsStatusView({
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
  const [expandedEpicId, setExpandedEpicId] = useState<string | null>(null)
  const [closedTypeFilter, setClosedTypeFilter] = useState<string | null>(null)
  const [showAllClosed, setShowAllClosed] = useState(false)
  const [showAllOpen, setShowAllOpen] = useState(false)

  const wip = issues.filter((b) => category(b.status) === 'wip')
  const blocked = issues.filter((b) => b.status === 'blocked')
  const frozen = issues.filter((b) => category(b.status) === 'frozen')
  const open = issues
    .filter((b) => category(b.status) === 'active')
    .sort((a, b) => (a.priority ?? 4) - (b.priority ?? 4))
  const closed = issues
    .filter((b) => b.status === 'closed')
    .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))

  // Epics: beads that have children — excluded from summary counts
  const epicsWithChildren = issues.filter((b) => childrenOf(b.id, issues).length > 0)
  const parentIds = new Set(epicsWithChildren.map((e) => e.id))

  // Summary counts use leaf beads only (no parents), avoiding double-counting
  const leafIssues = issues.filter((b) => !parentIds.has(b.id))
  const leafClosed = leafIssues.filter((b) => b.status === 'closed')
  const total = leafIssues.length
  const pct = total ? Math.round((leafClosed.length / total) * 100) : 0

  const visibleClosed = showAllClosed ? closed : closed.slice(0, 8)
  const visibleOpen = showAllOpen ? open : open.slice(0, 8)

  return (
    <div className="flex flex-col gap-6">
      {/* toolbar */}
      <div className="flex items-center justify-between">
        {fetchedAt && (
          <span className="text-xs text-muted-foreground">
            Last synced: {fetchedAt.slice(0, 16)}
          </span>
        )}
        {onSync && (
          <Button variant="outline" size="sm" onClick={onSync} disabled={syncing} className="ml-auto">
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        )}
      </div>

      {syncError && <p className="text-sm text-destructive">{syncError}</p>}

      {/* Summary card */}
      <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-4xl font-bold tracking-tight">{pct}%</p>
            <p className="text-sm text-muted-foreground mt-1">
              {leafClosed.length} of {total} complete
            </p>
          </div>
          <div className="flex gap-6 text-sm pt-1">
            {wip.length > 0 && (
              <div className="text-right">
                <p className="text-xl font-semibold">{wip.length}</p>
                <p className="text-xs text-muted-foreground">in progress</p>
              </div>
            )}
            {blocked.length > 0 && (
              <div className="text-right">
                <p className="text-xl font-semibold text-destructive">{blocked.length}</p>
                <p className="text-xs text-muted-foreground">blocked</p>
              </div>
            )}
            {open.length > 0 && (
              <div className="text-right">
                <p className="text-xl font-semibold">{open.length}</p>
                <p className="text-xs text-muted-foreground">queued</p>
              </div>
            )}
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Velocity chart */}
      <BeadsVelocity issues={issues} />

      {/* Workstreams / epics rollup */}
      {epicsWithChildren.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Workstreams
          </h2>
          <div className="flex flex-col gap-2">
            {epicsWithChildren.map((epic) => {
              const { closed: ec, total: et, pct: ep } = epicProgress(epic.id, issues)
              const isExpanded = expandedEpicId === epic.id
              const children = childrenOf(epic.id, issues)
              return (
                <div key={epic.id} className="rounded-lg border overflow-hidden">
                  <button
                    onClick={() => setExpandedEpicId(isExpanded ? null : epic.id)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <span className="text-muted-foreground w-3 flex-shrink-0 text-xs">
                      {isExpanded ? '▾' : '▸'}
                    </span>
                    <span className="flex-1 min-w-0 text-sm font-medium truncate">{epic.title}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{ec}/{et}</span>
                    <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${ep}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-8 text-right">{ep}%</span>
                  </button>
                  {isExpanded && (
                    <div className="border-t divide-y divide-border bg-muted/20">
                      {children.map((child) => (
                        <BeadRow key={child.id} bead={child} onClick={() => setSelected(child)} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Blocked */}
      {blocked.length > 0 && (
        <Section title="Blocked" count={blocked.length} accent="var(--destructive)">
          {blocked.map((b) => (
            <BeadRow key={b.id} bead={b} onClick={() => setSelected(b)} />
          ))}
        </Section>
      )}

      {/* In Progress */}
      {wip.length > 0 && (
        <Section title="In Progress" count={wip.length}>
          {wip.map((b) => (
            <BeadRow key={b.id} bead={b} onClick={() => setSelected(b)} />
          ))}
        </Section>
      )}

      {/* Recently Completed */}
      {closed.length > 0 && (() => {
        const closedTypes = [...new Set(closed.map((b) => b.issue_type ?? b.type ?? 'task'))]
        const filteredClosed = closedTypeFilter
          ? closed.filter((b) => (b.issue_type ?? b.type ?? 'task') === closedTypeFilter)
          : closed
        const visibleFiltered = showAllClosed ? filteredClosed : filteredClosed.slice(0, 8)
        return (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Completed <span className="text-foreground">{filteredClosed.length}</span>
              </h2>
              {closedTypes.length > 1 && (
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <button
                    onClick={() => { setClosedTypeFilter(null); setShowAllClosed(false) }}
                    className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors ${
                      closedTypeFilter === null
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                    }`}
                  >
                    All
                  </button>
                  {closedTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setClosedTypeFilter(t); setShowAllClosed(false) }}
                      className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border transition-colors capitalize ${
                        closedTypeFilter === t
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-lg border divide-y divide-border">
              {visibleFiltered.map((b) => (
                <BeadRow key={b.id} bead={b} onClick={() => setSelected(b)} />
              ))}
            </div>
            {filteredClosed.length > 8 && (
              <button
                onClick={() => setShowAllClosed(!showAllClosed)}
                className="mt-2 text-xs text-primary hover:underline"
              >
                {showAllClosed ? 'Show less' : `Show all ${filteredClosed.length}`}
              </button>
            )}
          </section>
        )
      })()}

      {/* Open / queued */}
      {open.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Queued <span className="text-foreground">{open.length}</span>
          </h2>
          <div className="rounded-lg border divide-y divide-border">
            {visibleOpen.map((b) => (
              <BeadRow key={b.id} bead={b} onClick={() => setSelected(b)} />
            ))}
          </div>
          {open.length > 8 && (
            <button
              onClick={() => setShowAllOpen(!showAllOpen)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {showAllOpen ? 'Show less' : `Show all ${open.length}`}
            </button>
          )}
        </section>
      )}

      {/* Deferred / paused — only show if present */}
      {frozen.length > 0 && (
        <Section title="Paused / Deferred" count={frozen.length}>
          {frozen.map((b) => (
            <BeadRow key={b.id} bead={b} onClick={() => setSelected(b)} />
          ))}
        </Section>
      )}

      <BeadDetailDrawer bead={selected} onClose={() => setSelected(null)} allIssues={issues} />
    </div>
  )
}
