'use client'

import { useMemo } from 'react'
import type { BeadsIssue } from '@/lib/types'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'

interface VelocityPoint {
  date: string
  label: string
  count: number
}

function getMondayKey(iso: string): string {
  const d = new Date(iso)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d.toISOString().slice(0, 10)
}

function buildVelocityData(issues: BeadsIssue[]): VelocityPoint[] {
  const byWeek: Record<string, number> = {}

  for (const b of issues) {
    if (b.status === 'closed' && b.updated_at) {
      const key = getMondayKey(b.updated_at)
      byWeek[key] = (byWeek[key] ?? 0) + 1
    }
  }

  return Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({
      date,
      label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      count,
    }))
}

function VelocityTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const count = payload[0]?.value ?? 0
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-sm shadow-md">
      <p className="text-muted-foreground mb-0.5">Week of <span className="text-foreground font-medium">{label}</span></p>
      <p className="text-muted-foreground">Closed: <span className="text-foreground font-medium">{count} item{count !== 1 ? 's' : ''}</span></p>
    </div>
  )
}

export function BeadsVelocity({ issues }: { issues: BeadsIssue[] }) {
  const data = useMemo(() => buildVelocityData(issues), [issues])

  if (data.length < 2) return null

  const avg = Math.round(data.reduce((s, d) => s + d.count, 0) / data.length)

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Velocity
        </h2>
        <span className="text-xs text-muted-foreground">
          avg <span className="text-foreground font-medium">{avg}</span> / week
        </span>
      </div>
      <div className="rounded-xl border bg-card p-4 pt-5">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
            <Tooltip content={<VelocityTooltip />} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
            <ReferenceLine
              y={avg}
              stroke="var(--muted-foreground)"
              strokeDasharray="4 3"
              strokeOpacity={0.5}
            />
            <Bar dataKey="count" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
