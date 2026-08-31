'use client'
import { useState } from 'react'
import type { Milestone, MilestoneStatus } from '@/lib/types'

interface Props {
  milestones: Milestone[]
  showTooltips?: boolean
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function daysFraction(rangeStart: Date, date: Date, totalDays: number): number {
  return Math.max(0, Math.min(1, (date.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24 * totalDays)))
}

function getMondaysInRange(start: Date, end: Date): Date[] {
  const mondays: Date[] = []
  const cur = new Date(start)
  const dow = cur.getDay()
  if (dow !== 1) cur.setDate(cur.getDate() + (dow === 0 ? 1 : 8 - dow))
  while (cur <= end) {
    mondays.push(new Date(cur))
    cur.setDate(cur.getDate() + 7)
  }
  return mondays
}

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

function barClasses(status: MilestoneStatus): string {
  switch (status) {
    case 'not_started':
      return 'bg-muted border border-border text-muted-foreground'
    case 'in_progress':
      return 'bg-primary/15 border border-primary/30 text-primary'
    case 'blocked':
      return 'bg-destructive/15 border border-destructive/30 text-destructive'
    case 'completed':
      return 'bg-green-100 border border-green-300 dark:bg-green-950 dark:border-green-800 text-green-700 dark:text-green-400'
  }
}

export function MilestonesGantt({ milestones, showTooltips = false }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  if (milestones.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No milestones yet.</p>
  }

  const sorted = [...milestones].sort((a, b) => a.startDate.localeCompare(b.startDate))

  const dates = sorted.flatMap((m) => [new Date(m.startDate), new Date(m.endDate)])
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

  const rangeStart = addDays(minDate, -7)
  const rangeEnd = addDays(maxDate, 7)
  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)

  const mondays = getMondaysInRange(rangeStart, rangeEnd)
  const weeks = mondays.length
  const minWidth = Math.max(700, weeks * 80 + 200)

  function formatShort(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div style={{ minWidth }}>
        {/* Header row */}
        <div className="flex border-b">
          <div className="flex-shrink-0" style={{ width: 200 }} />
          <div className="flex-1 relative h-8">
            {mondays.map((monday, i) => {
              const left = daysFraction(rangeStart, monday, totalDays) * 100
              return (
                <span
                  key={i}
                  className="absolute top-1 text-xs text-muted-foreground select-none"
                  style={{ left: `${left}%`, transform: 'translateX(-50%)' }}
                >
                  {formatShort(monday)}
                </span>
              )
            })}
          </div>
        </div>

        {/* Milestone rows */}
        {sorted.map((milestone) => {
          const startFrac = daysFraction(rangeStart, new Date(milestone.startDate), totalDays)
          const endFrac = daysFraction(rangeStart, new Date(milestone.endDate), totalDays)
          const widthFrac = Math.max(0.01, endFrac - startFrac)
          const isHovered = hoveredId === milestone.id

          return (
            <div key={milestone.id} className="flex border-b last:border-b-0 h-12 items-center">
              {/* Label */}
              <div
                className="flex-shrink-0 px-3 text-sm font-medium truncate text-foreground"
                style={{ width: 200 }}
                title={milestone.name}
              >
                {milestone.name}
              </div>

              {/* Timeline */}
              <div className="flex-1 relative h-full">
                {/* Week gridlines */}
                {mondays.map((monday, i) => {
                  const left = daysFraction(rangeStart, monday, totalDays) * 100
                  return (
                    <div
                      key={i}
                      className="absolute top-0 bottom-0 border-l border-border/40"
                      style={{ left: `${left}%` }}
                    />
                  )
                })}

                {/* Bar */}
                <div
                  className={`absolute top-3 h-6 rounded flex items-center px-2 cursor-default overflow-hidden ${barClasses(milestone.status)}`}
                  style={{
                    left: `${startFrac * 100}%`,
                    width: `${widthFrac * 100}%`,
                  }}
                  onMouseEnter={() => showTooltips && setHoveredId(milestone.id)}
                  onMouseLeave={() => showTooltips && setHoveredId(null)}
                >
                  <span className="text-xs truncate">{milestone.name}</span>

                  {/* Tooltip */}
                  {showTooltips && isHovered && (
                    <div
                      className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none"
                    >
                      <p className="font-semibold">{milestone.name}</p>
                      <p className="text-muted-foreground">{STATUS_LABELS[milestone.status]}</p>
                      <p className="text-muted-foreground">{milestone.startDate} – {milestone.endDate}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
