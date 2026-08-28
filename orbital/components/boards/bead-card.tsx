'use client'
import type { BeadsIssue } from '@/lib/types'
import { catColor, prioLabel, prioColor, avatarColor, initials, statusLabel } from '@/lib/beads-view'

export function BeadCard({ bead, onClick }: { bead: BeadsIssue; onClick: () => void }) {
  const issueType = bead.issue_type ?? bead.type ?? 'task'
  const visLabels = (bead.labels ?? []).filter((l) => !['archived'].includes(l)).slice(0, 2)
  const depCount = bead.dependencies.filter((d) => d.type !== 'parent-child').length
  const prio = bead.priority

  return (
    <article
      onClick={onClick}
      className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-md"
    >
      {/* top row: status dot + ID + priority */}
      <div className="flex items-center gap-2">
        <span
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ background: catColor(bead.status) }}
          title={statusLabel(bead.status)}
        />
        <span className="flex-1 font-mono text-[11px] text-muted-foreground">{bead.id}</span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
          style={{ background: prioColor(prio) }}
        >
          {prioLabel(prio)}
        </span>
      </div>

      {/* title */}
      <p className="text-[13px] font-[550] leading-snug">{bead.title}</p>

      {/* type + labels */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded border border-border bg-muted/40 px-1.5 py-px text-[10.5px] text-muted-foreground capitalize">{issueType}</span>
        {visLabels.map((l) => (
          <span key={l} className="rounded border border-border bg-muted/40 px-1.5 py-px font-mono text-[10px] text-muted-foreground">{l}</span>
        ))}
      </div>

      {/* bottom row: assignee + deps */}
      <div className="flex items-center gap-2 border-t border-border pt-2 mt-0.5">
        <span
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white"
          style={{ background: avatarColor(bead.assignee ?? '') }}
        >
          {initials(bead.assignee ?? '')}
        </span>
        <span className="flex-1 truncate text-[11px] text-muted-foreground">{bead.assignee || 'Unassigned'}</span>
        {depCount > 0 && (
          <span className="text-[10px] text-muted-foreground">{depCount} dep{depCount !== 1 ? 's' : ''}</span>
        )}
      </div>
    </article>
  )
}
