import { Badge } from '@/components/ui/badge'
import type { StatusLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

const CONFIG: Record<StatusLevel, { label: string; className: string }> = {
  on_track:  { label: 'On Track',  className: 'bg-green-500/15 text-green-400 border-green-500/25' },
  at_risk:   { label: 'At Risk',   className: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  off_track: { label: 'Off Track', className: 'bg-red-500/15 text-red-400 border-red-500/25' },
}

export function StatusBadge({ status }: { status: StatusLevel }) {
  const { label, className } = CONFIG[status]
  return <Badge variant="outline" className={cn(className)}>{label}</Badge>
}
