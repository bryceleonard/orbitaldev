import type { StatusLevel } from '@/lib/types'

interface CircularProgressProps {
  percent: number
  status: StatusLevel
  size?: number
  strokeWidth?: number
  children: React.ReactNode
}

const STATUS_COLOR: Record<StatusLevel, string> = {
  on_track:  '#16a34a',
  at_risk:   '#d97706',
  off_track: '#dc2626',
}

export function CircularProgress({
  percent,
  status,
  size = 140,
  strokeWidth = 10,
  children,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(100, Math.max(0, percent))
  const offset = circumference * (1 - clamped / 100)
  const stroke = STATUS_COLOR[status]

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(0,0,0,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={stroke}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}
