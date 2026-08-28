import type { BeadsIssue } from './types'

// Status categories
type StatusCategory = 'done' | 'wip' | 'blocked' | 'frozen' | 'active'

export function category(status: string): StatusCategory {
  if (status === 'closed') return 'done'
  if (status === 'in_progress' || status === 'hooked' || status === 'in_review') return 'wip'
  if (status === 'blocked') return 'blocked'
  if (status === 'deferred' || status === 'pinned' || status === 'rework') return 'frozen'
  return 'active'
}

export const CAT_COLORS: Record<StatusCategory, string> = {
  done: '#16a34a',
  wip: '#d97706',
  blocked: '#ef4444',
  frozen: '#64748b',
  active: '#3b82f6',
}

export function catColor(status: string): string {
  return CAT_COLORS[category(status)] ?? '#3b82f6'
}

export const PRIO_COLORS = ['#ef4444', '#f97316', '#eab308', '#0ea5e9', '#64748b']
export const PRIO_LABELS = ['Critical', 'High', 'Medium', 'Low', 'Backlog']

export function prioColor(priority: number): string {
  return PRIO_COLORS[priority] ?? '#64748b'
}

export function prioLabel(priority: number): string {
  return PRIO_LABELS[priority] ?? 'Unknown'
}

export const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  deferred: 'Deferred',
  closed: 'Closed',
  pinned: 'Pinned',
  in_review: 'In Review',
  rework: 'Rework',
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status
}

const AVATARS = ['#6d5ef0', '#0ea5e9', '#16a34a', '#d97706', '#db2777', '#0891b2', '#7c3aed']

export function avatarColor(name: string): string {
  if (!name) return '#9aa0aa'
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0
  return AVATARS[h % AVATARS.length]
}

export function initials(name: string): string {
  if (!name) return '?'
  const parts = name.split(/[-_ .]/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function relTime(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return ''
  const d = (now.getTime() - new Date(iso).getTime()) / 1000
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  if (d < 2592000) return `${Math.floor(d / 86400)}d ago`
  return `${Math.floor(d / 2592000)}mo ago`
}

export function makeIndex(beads: BeadsIssue[]): Map<string, BeadsIssue> {
  return new Map(beads.map((b) => [b.id, b]))
}

export function parentOf(b: BeadsIssue, index: Map<string, BeadsIssue>): BeadsIssue | null {
  // Try direct parent field first (beads_rust), then dep edge
  const pid = b.parentId ?? b.parent
  if (pid) return index.get(pid) ?? null
  const dep = b.dependencies.find((d) => d.type === 'parent-child')
  return dep ? index.get(dep.depends_on_id) ?? null : null
}

export function childrenOf(parentId: string, beads: BeadsIssue[]): BeadsIssue[] {
  return beads.filter((b) => {
    if (b.parentId === parentId || b.parent === parentId) return true
    return b.dependencies.some((d) => d.type === 'parent-child' && d.depends_on_id === parentId)
  })
}

export function epicProgress(
  parentId: string,
  beads: BeadsIssue[],
): { closed: number; total: number; pct: number } {
  const kids = childrenOf(parentId, beads)
  const total = kids.length
  const closed = kids.filter((k) => k.status === 'closed').length
  return { closed, total, pct: total ? Math.round((closed / total) * 100) : 0 }
}
