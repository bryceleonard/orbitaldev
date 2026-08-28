'use client'
import type { BeadsIssue } from '@/lib/types'
import {
  catColor,
  prioLabel,
  prioColor,
  avatarColor,
  initials,
  statusLabel,
  relTime,
  makeIndex,
} from '@/lib/beads-view'

export function BeadDetailDrawer({
  bead,
  onClose,
  allIssues,
}: {
  bead: BeadsIssue | null
  onClose: () => void
  allIssues: BeadsIssue[]
}) {
  if (!bead) return null

  const index = makeIndex(allIssues)
  const parentId = bead.parentId ?? bead.parent
  const parentIssue = parentId ? index.get(parentId) : null
  const issueType = bead.issue_type ?? bead.type ?? 'task'

  // Group deps by type, excluding parent-child
  const depsByType = new Map<string, typeof bead.dependencies>()
  for (const dep of bead.dependencies) {
    if (dep.type === 'parent-child') continue
    if (!depsByType.has(dep.type)) depsByType.set(dep.type, [])
    depsByType.get(dep.type)!.push(dep)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col overflow-y-auto border-l border-border bg-background p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{bead.id}</span>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Title */}
        <h2 className="mb-4 text-base font-semibold leading-snug">{bead.title}</h2>

        {/* Badges row */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded border border-border bg-muted/40 px-2 py-0.5 text-xs">
            <span
              className="h-2 w-2 flex-shrink-0 rounded-full"
              style={{ background: catColor(bead.status) }}
            />
            {statusLabel(bead.status)}
          </span>
          <span className="rounded border border-border bg-muted/40 px-2 py-0.5 text-xs capitalize">
            {issueType}
          </span>
          <span
            className="rounded px-2 py-0.5 text-xs font-semibold text-white"
            style={{ background: prioColor(bead.priority) }}
          >
            {prioLabel(bead.priority)}
          </span>
        </div>

        {/* Assignee */}
        <div className="mb-4 flex items-center gap-2">
          <span
            className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: avatarColor(bead.assignee ?? '') }}
          >
            {initials(bead.assignee ?? '')}
          </span>
          <span className="text-sm text-muted-foreground">{bead.assignee || 'Unassigned'}</span>
        </div>

        {/* Parent link */}
        {parentIssue && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Parent</p>
            <p className="text-sm">
              <span className="mr-1 font-mono text-xs text-muted-foreground">{parentIssue.id}</span>
              {parentIssue.title}
            </p>
          </div>
        )}

        {/* Description */}
        {bead.description && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Description</p>
            <p className="whitespace-pre-wrap text-sm">{bead.description}</p>
          </div>
        )}

        {/* Acceptance criteria */}
        {bead.acceptance_criteria && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Acceptance Criteria</p>
            <p className="whitespace-pre-wrap text-sm">{bead.acceptance_criteria}</p>
          </div>
        )}

        {/* Notes */}
        {bead.notes && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Notes</p>
            <p className="whitespace-pre-wrap text-sm">{bead.notes}</p>
          </div>
        )}

        {/* Labels */}
        {bead.labels && bead.labels.length > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Labels</p>
            <div className="flex flex-wrap gap-1.5">
              {bead.labels.map((l) => (
                <span
                  key={l}
                  className="rounded border border-border bg-muted/40 px-1.5 py-px font-mono text-[10px] text-muted-foreground"
                >
                  {l}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Dependencies */}
        {depsByType.size > 0 && (
          <div className="mb-4">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Dependencies</p>
            <div className="flex flex-col gap-2">
              {[...depsByType.entries()].map(([type, deps]) => (
                <div key={type}>
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">{type}</p>
                  {deps.map((dep) => {
                    const linked = index.get(dep.depends_on_id)
                    return (
                      <div key={dep.depends_on_id} className="flex items-baseline gap-1.5">
                        <span className="font-mono text-[11px] text-muted-foreground">{dep.depends_on_id}</span>
                        {linked && <span className="text-xs text-foreground">{linked.title}</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comments */}
        {bead.comments && bead.comments.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-medium text-muted-foreground">Comments</p>
            <div className="flex flex-col gap-3">
              {bead.comments.map((c, i) => (
                <div key={c.id ?? i} className="rounded-lg border border-border bg-muted/20 p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-medium">{c.author}</span>
                    {c.created_at && (
                      <span className="text-[10px] text-muted-foreground">{relTime(c.created_at)}</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-xs">{c.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dates */}
        <div className="mt-auto border-t border-border pt-4">
          <div className="flex flex-col gap-1">
            {bead.created_at && (
              <p className="text-[10px] text-muted-foreground">
                Created {relTime(bead.created_at)}
                {bead.created_by && ` by ${bead.created_by}`}
              </p>
            )}
            {bead.updated_at && (
              <p className="text-[10px] text-muted-foreground">Updated {relTime(bead.updated_at)}</p>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
