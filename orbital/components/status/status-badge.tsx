import { Badge } from '@/components/ui/badge'
import type { StatusLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

const CONFIG: Record<StatusLevel, { label: string; className: string }> = {
  on_track:  { label: 'On Track',  className: 'bg-green-100 text-green-800 border-green-200' },
  at_risk:   { label: 'At Risk',   className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  off_track: { label: 'Off Track', className: 'bg-red-100 text-red-800 border-red-200' },
}

export function StatusBadge({ status }: { status: StatusLevel }) {
  const { label, className } = CONFIG[status]
  return <Badge variant="outline" className={cn(className)}>{label}</Badge>
}
