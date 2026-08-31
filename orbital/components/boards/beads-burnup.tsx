'use client'

import { useMemo } from 'react'
import type { BeadsIssue } from '@/lib/types'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface BurnUpPoint {
  date: string
  label: string
  scope: number
  completed: number
}

function buildBurnUpData(issues: BeadsIssue[]): BurnUpPoint[] {
  const createdByDate: Record<string, number> = {}
  const closedByDate: Record<string, number> = {}

  for (const b of issues) {
    if (b.created_at) {
      const d = b.created_at.slice(0, 10)
      createdByDate[d] = (createdByDate[d] ?? 0) + 1
    }
    if (b.status === 'closed' && b.updated_at) {
      const d = b.updated_at.slice(0, 10)
      closedByDate[d] = (closedByDate[d] ?? 0) + 1
    }
  }

  const allDates = [...Object.keys(createdByDate), ...Object.keys(closedByDate)].sort()
  if (allDates.length === 0) return []

  const start = new Date(allDates[0])
  const end = new Date()

  const daily: BurnUpPoint[] = []
  let cumScope = 0
  let cumCompleted = 0
  const cur = new Date(start)

  while (cur <= end) {
    const key = cur.toISOString().slice(0, 10)
    cumScope += createdByDate[key] ?? 0
    cumCompleted += closedByDate[key] ?? 0
    daily.push({
      date: key,
      label: cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      scope: cumScope,
      completed: cumCompleted,
    })
    cur.setDate(cur.getDate() + 1)
  }

  // Thin to keep the chart readable regardless of project length
  const n = daily.length
  if (n <= 30) return daily
  const step = n <= 90 ? 3 : n <= 180 ? 7 : 14
  return daily.filter((_, i) => i % step === 0 || i === daily.length - 1)
}

function BurnUpTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const scope = payload.find((p) => p.dataKey === 'scope')?.value ?? 0
  const completed = payload.find((p) => p.dataKey === 'completed')?.value ?? 0
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="font-medium mb-1.5">{label}</p>
      <div className="flex flex-col gap-0.5">
        <p className="text-muted-foreground">
          Scope: <span className="text-foreground font-medium">{scope}</span>
        </p>
        <p className="text-muted-foreground">
          Completed: <span className="text-foreground font-medium">{completed}</span>
        </p>
        <p className="text-muted-foreground">
          Remaining: <span className="text-foreground font-medium">{scope - completed}</span>
        </p>
      </div>
    </div>
  )
}

export function BeadsBurnUp({ issues }: { issues: BeadsIssue[] }) {
  const data = useMemo(() => buildBurnUpData(issues), [issues])

  if (data.length < 2) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Burn-up
        </h2>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-5 border-t-2 border-dashed border-muted-foreground/50" />
            Scope
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-px w-5 border-t-2 border-primary" />
            Completed
          </span>
        </div>
      </div>
      <div className="rounded-xl border bg-card p-4 pt-5">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip content={<BurnUpTooltip />} />
            <Line
              type="monotone"
              dataKey="scope"
              stroke="var(--muted-foreground)"
              strokeWidth={1.5}
              strokeOpacity={0.4}
              strokeDasharray="5 3"
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="completed"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
