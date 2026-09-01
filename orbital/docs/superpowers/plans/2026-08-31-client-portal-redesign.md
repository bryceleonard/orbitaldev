# Client Portal Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the FortyAU dark brand to the PM and client portals, consolidate the portal Overview and Status tabs into one page, and replace the status number cards with circular SVG progress charts for Schedule and Budget.

**Architecture:** A `.orbital` CSS class scoped to `(pm)/layout.tsx` and `(client)/layout.tsx` overrides all shadcn CSS tokens to the FortyAU dark palette; shadcn components inherit the tokens automatically. A new `CircularProgress` SVG component powers the Schedule and Budget rings. The portal Overview page absorbs the Status page's data fetching and is deleted.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, shadcn/ui, `next/font/google`, `@tanstack/react-query`, Vitest, `@testing-library/react`

## Global Constraints

- No external charting library — `CircularProgress` is pure SVG
- No `Issues` data — that collection is sunsetted; `listRisks` only
- `scopeStatus` removed from all portal UI; field remains in types untouched
- FortyAU brand colors (exact hex — never approximate):
  - `--void`: `#0f0c1a`
  - `--cosmos`: `#161228`
  - `--nebula`: `#1e1a35`
  - `--cloud`: `#2a2548`
  - `--star`: `#fad542`
  - `--text-1`: `#f4eeff`
  - `--text-2`: `#bfb3db`
- Run tests: `npm test` (runs `vitest run`)
- Commit after every task

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `app/globals.css` | Modify | Add `.orbital` CSS variable overrides block |
| `app/(pm)/layout.tsx` | Modify | Load brand fonts, apply `.orbital` wrapper class |
| `app/(client)/layout.tsx` | Modify | Load brand fonts, apply `.orbital` wrapper class |
| `components/ui/circular-progress.tsx` | Create | SVG ring chart, status-driven color, children in center |
| `components/ui/circular-progress.test.tsx` | Create | Unit tests for arc math and status colors |
| `app/(client)/portal/[projectId]/overview/page.tsx` | Rewrite | Consolidated overview+status page with all data fetching |
| `components/portal/portal-overview.test.tsx` | Rewrite | Updated tests for consolidated page |
| `app/(client)/portal/[projectId]/status/page.tsx` | Delete | Content absorbed into overview page |
| `components/portal/portal-project-tabs.tsx` | Modify | Remove Status tab, restyle to brand JetBrains Mono tabs |
| `components/portal/portal-project-tabs.test.tsx` | Modify | Remove Status tab assertions, keep board and active-tab tests |

---

## Task 1: CSS Theme Tokens

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `.orbital` CSS class that overrides all shadcn tokens to FortyAU dark palette; consumed by Tasks 2–5

- [ ] **Step 1: Add `.orbital` block to `globals.css`**

Open `app/globals.css` and append this block after the `.dark { … }` block (around line 119):

```css
.orbital {
  --background: #161228;
  --foreground: #f4eeff;
  --card: #1e1a35;
  --card-foreground: #f4eeff;
  --popover: #1e1a35;
  --popover-foreground: #f4eeff;
  --primary: #fad542;
  --primary-foreground: #0f0c1a;
  --secondary: #2a2548;
  --secondary-foreground: #f4eeff;
  --muted: #2a2548;
  --muted-foreground: #bfb3db;
  --accent: #2a2548;
  --accent-foreground: #f4eeff;
  --border: rgba(255, 255, 255, 0.08);
  --input: rgba(255, 255, 255, 0.08);
  --ring: rgba(250, 213, 66, 0.4);
  --sidebar: #0f0c1a;
  --sidebar-foreground: #f4eeff;
  --sidebar-border: rgba(255, 255, 255, 0.08);
  --sidebar-accent: #1e1a35;
  --sidebar-accent-foreground: #f4eeff;
  --sidebar-primary: #fad542;
  --sidebar-primary-foreground: #0f0c1a;
  --sidebar-ring: rgba(250, 213, 66, 0.4);
}
```

- [ ] **Step 2: Override font tokens inside `.orbital`**

Inside the same `.orbital` block (after the sidebar vars), add:

```css
  --font-sans: var(--font-bricolage);
  --font-mono: var(--font-jetbrains);
```

The full `.orbital` block now contains both the color tokens and the font overrides. These CSS variable names (`--font-bricolage`, `--font-jetbrains`) will be provided by the font loaders added in Task 2.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add .orbital scoped FortyAU brand CSS tokens"
```

---

## Task 2: Font Loading & Layout Wrappers

**Files:**
- Modify: `app/(pm)/layout.tsx`
- Modify: `app/(client)/layout.tsx`

**Interfaces:**
- Consumes: `.orbital` CSS class from Task 1
- Produces: FortyAU fonts available as CSS variables, `.orbital` class applied to PM and client shell wrappers

- [ ] **Step 1: Update `(client)/layout.tsx`**

Replace the entire file with:

```tsx
import { Bricolage_Grotesque, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import { PortalNav } from '@/components/portal/portal-nav'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['200', '400', '600', '700', '800'],
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '700'],
})
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument',
  style: ['normal', 'italic'],
  weight: '400',
})

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`orbital min-h-screen flex flex-col ${bricolage.variable} ${jetbrains.variable} ${instrumentSerif.variable}`}>
      <PortalNav />
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Update `(pm)/layout.tsx`**

This file is an async server component — add font loading before the `return`, and wrap the returned JSX in an `.orbital` div. Keep all existing auth/redirect logic untouched.

```tsx
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { Bricolage_Grotesque, JetBrains_Mono, Instrument_Serif } from 'next/font/google'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { PmSidebar } from '@/components/layout/pm-sidebar'

const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['200', '400', '600', '700', '800'],
})
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  weight: ['400', '500', '700'],
})
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  variable: '--font-instrument',
  style: ['normal', 'italic'],
  weight: '400',
})

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

export default async function PmLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(COOKIE)?.value

  if (!sessionCookie) redirect('/login')

  let uid: string
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    uid = decoded.uid
  } catch {
    redirect('/login')
  }

  try {
    const userSnap = await adminDb.doc(`users/${uid}`).get()
    if (!userSnap.exists || !userSnap.data()?.orgId) redirect('/onboarding')
  } catch {
    redirect('/onboarding')
  }

  return (
    <div className={`orbital flex h-screen ${bricolage.variable} ${jetbrains.variable} ${instrumentSerif.variable}`}>
      <PmSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(client)/layout.tsx app/(pm)/layout.tsx
git commit -m "feat: load FortyAU brand fonts and apply .orbital wrapper to PM and client layouts"
```

---

## Task 3: CircularProgress Component

**Files:**
- Create: `components/ui/circular-progress.tsx`
- Create: `components/ui/circular-progress.test.tsx`

**Interfaces:**
- Produces: `CircularProgress` component — consumed by Task 4

```ts
// Exported interface
interface CircularProgressProps {
  percent: number           // 0–100, clamped internally
  status: 'on_track' | 'at_risk' | 'off_track'
  size?: number             // px, default 140
  strokeWidth?: number      // px, default 10
  children: React.ReactNode // rendered in center of ring
}
```

- [ ] **Step 1: Write the failing tests**

Create `components/ui/circular-progress.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, test, expect } from 'vitest'
import { CircularProgress } from './circular-progress'

const size = 140
const strokeWidth = 10
const radius = (size - strokeWidth) / 2          // 65
const circumference = 2 * Math.PI * radius       // ~408.41

describe('CircularProgress', () => {
  test('renders children inside the ring', () => {
    const { getByText } = render(
      <CircularProgress percent={50} status="on_track"><span>Hello</span></CircularProgress>
    )
    expect(getByText('Hello')).toBeInTheDocument()
  })

  test('sets stroke-dashoffset correctly for 50%', () => {
    const { container } = render(
      <CircularProgress percent={50} status="on_track" size={140} strokeWidth={10}>
        <span />
      </CircularProgress>
    )
    const arcs = container.querySelectorAll('circle')
    const offset = parseFloat(arcs[1].getAttribute('stroke-dashoffset') ?? '0')
    expect(offset).toBeCloseTo(circumference * 0.5, 0)
  })

  test('sets stroke-dashoffset to 0 for 100%', () => {
    const { container } = render(
      <CircularProgress percent={100} status="on_track" size={140} strokeWidth={10}>
        <span />
      </CircularProgress>
    )
    const arcs = container.querySelectorAll('circle')
    const offset = parseFloat(arcs[1].getAttribute('stroke-dashoffset') ?? '1')
    expect(offset).toBeCloseTo(0, 0)
  })

  test('clamps percent above 100 to full circle', () => {
    const { container } = render(
      <CircularProgress percent={150} status="on_track" size={140} strokeWidth={10}>
        <span />
      </CircularProgress>
    )
    const arcs = container.querySelectorAll('circle')
    const offset = parseFloat(arcs[1].getAttribute('stroke-dashoffset') ?? '1')
    expect(offset).toBeCloseTo(0, 0)
  })

  test('uses gold stroke for on_track', () => {
    const { container } = render(
      <CircularProgress percent={75} status="on_track"><span /></CircularProgress>
    )
    expect(container.querySelectorAll('circle')[1]).toHaveAttribute('stroke', '#fad542')
  })

  test('uses amber stroke for at_risk', () => {
    const { container } = render(
      <CircularProgress percent={75} status="at_risk"><span /></CircularProgress>
    )
    expect(container.querySelectorAll('circle')[1]).toHaveAttribute('stroke', '#f59e0b')
  })

  test('uses red stroke for off_track', () => {
    const { container } = render(
      <CircularProgress percent={75} status="off_track"><span /></CircularProgress>
    )
    expect(container.querySelectorAll('circle')[1]).toHaveAttribute('stroke', '#ef4444')
  })

  test('track ring uses low-opacity white stroke', () => {
    const { container } = render(
      <CircularProgress percent={50} status="on_track"><span /></CircularProgress>
    )
    expect(container.querySelectorAll('circle')[0]).toHaveAttribute('stroke', 'rgba(255,255,255,0.08)')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- circular-progress
```

Expected: multiple failures — `CircularProgress` not found.

- [ ] **Step 3: Create the component**

Create `components/ui/circular-progress.tsx`:

```tsx
import type { StatusLevel } from '@/lib/types'

interface CircularProgressProps {
  percent: number
  status: StatusLevel
  size?: number
  strokeWidth?: number
  children: React.ReactNode
}

const STATUS_COLOR: Record<StatusLevel, string> = {
  on_track: '#fad542',
  at_risk: '#f59e0b',
  off_track: '#ef4444',
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
          stroke="rgba(255,255,255,0.08)"
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- circular-progress
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/ui/circular-progress.tsx components/ui/circular-progress.test.tsx
git commit -m "feat: add CircularProgress SVG ring chart component"
```

---

## Task 4: Consolidated Portal Overview Page

**Files:**
- Rewrite: `app/(client)/portal/[projectId]/overview/page.tsx`
- Rewrite: `components/portal/portal-overview.test.tsx`
- Delete: `app/(client)/portal/[projectId]/status/page.tsx`

**Interfaces:**
- Consumes: `CircularProgress` from Task 3
- Consumes: `listResources` from `@/lib/firestore/resources`
- Consumes: `listRisks` from `@/lib/firestore/risks`
- Consumes: `listClientActions` from `@/lib/firestore/client-actions`
- Consumes: `useProject` from `@/hooks/use-project`

- [ ] **Step 1: Write the failing tests**

Replace all content in `components/portal/portal-overview.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import type { Risk, Resource, ClientAction } from '@/lib/types'

const mockProject = {
  id: 'p1', orgId: 'o1', name: 'Alpha', description: 'Test project',
  techStack: ['React', 'Next.js'], pmTools: [], status: 'active' as const,
  trackerBoards: [],
  members: { uid1: 'viewer' as const },
  sow: { startDate: '2026-01-01', endDate: '2026-12-31', totalHours: 1000, summary: 'Build it.' },
  statusHeader: {
    scheduleStatus: 'on_track' as const,
    budgetStatus: 'at_risk' as const,
    scopeStatus: 'on_track' as const,
  },
  createdBy: 'uid1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

const mockResources: Resource[] = [
  { id: 'r1', name: 'Alice', role: 'Dev', hours: 300 },
  { id: 'r2', name: 'Bob',   role: 'QA',  hours: 180 },
]

const mockRisks: Risk[] = [
  {
    id: 'risk1', title: 'Budget overrun', severity: 'high',
    description: 'Costs rising fast.', status: 'open',
    owner: '', createdAt: '', updatedAt: '',
  },
  {
    id: 'risk2', title: 'Resolved risk', severity: 'low',
    description: '', status: 'resolved',
    owner: '', createdAt: '', updatedAt: '',
  },
]

const mockActions: ClientAction[] = [
  { id: 'a1', stakeholderName: 'Client Corp', description: 'Approve design', resolved: false },
  { id: 'a2', stakeholderName: 'Other',       description: 'Already done',   resolved: true },
]

vi.mock('@/hooks/use-org', () => ({ useOrgId: vi.fn(() => 'o1') }))
vi.mock('next/navigation', () => ({ useParams: vi.fn(() => ({ projectId: 'p1' })) }))
vi.mock('@/hooks/use-project', () => ({ useProject: vi.fn(() => ({ data: mockProject })) }))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'resources') return { data: mockResources }
      if (queryKey[0] === 'risks')     return { data: mockRisks }
      if (queryKey[0] === 'clientActions') return { data: mockActions }
      return { data: [] }
    }),
  }
})

describe('Consolidated portal overview page', () => {
  let Page: React.ComponentType

  beforeEach(async () => {
    Page = (await import('@/app/(client)/portal/[projectId]/overview/page')).default
  })

  test('renders project name, description, and tech stack', () => {
    render(<Page />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Test project')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Next.js')).toBeInTheDocument()
  })

  test('renders SOW summary', () => {
    render(<Page />)
    expect(screen.getByText('Build it.')).toBeInTheDocument()
  })

  test('renders engagement dates', () => {
    render(<Page />)
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument()
    expect(screen.getByText(/2026-12-31/)).toBeInTheDocument()
  })

  test('renders schedule percentage', () => {
    render(<Page />)
    expect(screen.getByText(/elapsed/i)).toBeInTheDocument()
  })

  test('renders budget percentage from resources (480 / 1000 = 48%)', () => {
    render(<Page />)
    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getByText(/480 of 1000 hrs/i)).toBeInTheDocument()
  })

  test('renders only open risks (not resolved)', () => {
    render(<Page />)
    expect(screen.getByText('Budget overrun')).toBeInTheDocument()
    expect(screen.queryByText('Resolved risk')).not.toBeInTheDocument()
  })

  test('renders unresolved actions only', () => {
    render(<Page />)
    expect(screen.getByText('Client Corp')).toBeInTheDocument()
    expect(screen.queryByText('Other')).not.toBeInTheDocument()
  })

  test('does not render scope status', () => {
    render(<Page />)
    expect(screen.queryByText(/scope/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- portal-overview
```

Expected: failures — new sections not yet present.

- [ ] **Step 3: Rewrite the overview page**

Replace all content in `app/(client)/portal/[projectId]/overview/page.tsx`:

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listResources } from '@/lib/firestore/resources'
import { listRisks } from '@/lib/firestore/risks'
import { listClientActions } from '@/lib/firestore/client-actions'
import { CircularProgress } from '@/components/ui/circular-progress'
import { StatusBadge } from '@/components/status/status-badge'
import { Badge } from '@/components/ui/badge'
import type { StatusLevel } from '@/lib/types'

function schedulePercent(sow: { startDate: string; endDate: string }): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))
}

function scheduleDays(sow: { startDate: string; endDate: string }): { elapsed: number; total: number } {
  if (!sow.startDate || !sow.endDate) return { elapsed: 0, total: 0 }
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  const now = Date.now()
  const total = Math.round((end - start) / 86_400_000)
  const elapsed = Math.min(total, Math.max(0, Math.round((now - start) / 86_400_000)))
  return { elapsed, total }
}

function budgetPercent(hoursConsumed: number, totalHours: number): number {
  if (!totalHours) return 0
  return Math.min(100, Math.round((hoursConsumed / totalHours) * 100))
}

const SEVERITY_COLOR: Record<string, string> = {
  low:    'bg-blue-500/10 text-blue-400 border-blue-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  high:   'bg-red-500/10  text-red-400  border-red-500/20',
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-px w-7 bg-[#fad542]" />
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#fad542]">
        {children}
      </span>
    </div>
  )
}

export default function PortalOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const enabled = !!orgId

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', orgId, projectId],
    queryFn: () => listResources(orgId!, projectId),
    enabled,
  })
  const { data: risks = [] } = useQuery({
    queryKey: ['risks', orgId, projectId],
    queryFn: () => listRisks(orgId!, projectId),
    enabled,
  })
  const { data: clientActions = [] } = useQuery({
    queryKey: ['clientActions', orgId, projectId],
    queryFn: () => listClientActions(orgId!, projectId),
    enabled,
  })

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const schedulePct = schedulePercent(project.sow)
  const { elapsed: daysElapsed, total: totalDays } = scheduleDays(project.sow)
  const hoursConsumed = resources.reduce((sum, r) => sum + r.hours, 0)
  const budgetPct = budgetPercent(hoursConsumed, project.sow.totalHours)
  const openRisks = risks.filter((r) => r.status === 'open')
  const unresolvedActions = clientActions.filter((a) => !a.resolved)

  return (
    <div className="max-w-3xl flex flex-col gap-10">
      {/* Project header */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
          {project.description && (
            <p className="mt-1 text-muted-foreground">{project.description}</p>
          )}
        </div>
        {project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {project.techStack.map((t) => (
              <Badge key={t} variant="secondary">{t}</Badge>
            ))}
          </div>
        )}
        <p className="font-mono text-[11px] text-muted-foreground tracking-[0.08em]">
          {project.sow.startDate || '—'} → {project.sow.endDate || '—'}
        </p>
        {project.sow.summary && (
          <p className="text-sm text-muted-foreground">{project.sow.summary}</p>
        )}
      </section>

      {/* Metrics row */}
      <section>
        <SectionLabel>Health</SectionLabel>
        <div className="grid grid-cols-2 gap-6">
          <MetricCard
            label="Schedule"
            percent={schedulePct}
            status={project.statusHeader.scheduleStatus}
            centerLabel={`${schedulePct}%`}
            centerSub="elapsed"
            metricLine={`${daysElapsed} of ${totalDays} days`}
          />
          <MetricCard
            label="Budget"
            percent={budgetPct}
            status={project.statusHeader.budgetStatus}
            centerLabel={project.sow.totalHours ? `${budgetPct}%` : '—'}
            centerSub="of budget"
            metricLine={
              project.sow.totalHours
                ? `${hoursConsumed} of ${project.sow.totalHours} hrs`
                : 'No budget set'
            }
          />
        </div>
      </section>

      {/* Open risks */}
      <section>
        <SectionLabel>Open Risks</SectionLabel>
        {openRisks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open risks.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {openRisks.map((r) => (
              <li key={r.id} className="bg-card border rounded-md px-4 py-3 flex items-start gap-3">
                <Badge
                  variant="outline"
                  className={SEVERITY_COLOR[r.severity] ?? ''}
                >
                  {r.severity.toUpperCase()}
                </Badge>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{r.title}</p>
                  {r.description && (
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions required */}
      {unresolvedActions.length > 0 && (
        <section>
          <SectionLabel>Action Required</SectionLabel>
          <ul className="flex flex-col gap-3">
            {unresolvedActions.map((a) => (
              <li key={a.id} className="bg-card border rounded-md px-4 py-3">
                <p className="text-sm font-medium">{a.stakeholderName}</p>
                <p className="text-sm text-muted-foreground">{a.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function MetricCard({
  label,
  percent,
  status,
  centerLabel,
  centerSub,
  metricLine,
}: {
  label: string
  percent: number
  status: StatusLevel
  centerLabel: string
  centerSub: string
  metricLine: string
}) {
  return (
    <div className="bg-card border rounded-md p-6 flex flex-col items-center gap-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground self-start">
        {label}
      </p>
      <CircularProgress percent={percent} status={status}>
        <span className="text-2xl font-bold leading-none">{centerLabel}</span>
        <span className="text-xs text-muted-foreground mt-1">{centerSub}</span>
      </CircularProgress>
      <StatusBadge status={status} />
      <p className="text-xs text-muted-foreground">{metricLine}</p>
    </div>
  )
}
```

- [ ] **Step 4: Delete the status page**

```bash
rm app/(client)/portal/\[projectId\]/status/page.tsx
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
npm test -- portal-overview
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add app/(client)/portal/\[projectId\]/overview/page.tsx \
        components/portal/portal-overview.test.tsx
git rm app/(client)/portal/\[projectId\]/status/page.tsx
git commit -m "feat: consolidate portal overview and status into single page with circular progress charts"
```

---

## Task 5: Portal Tabs Restyling

**Files:**
- Modify: `components/portal/portal-project-tabs.tsx`
- Modify: `components/portal/portal-project-tabs.test.tsx`

**Interfaces:**
- Consumes: `.orbital` CSS class (font-mono maps to JetBrains Mono via Task 1/2)

- [ ] **Step 1: Update the tabs test**

Remove all assertions that reference the "Status" tab. Update the mock pathname (previously `/portal/p1/status` — change to `/portal/p1/overview`). Remove `adoPat` from board mocks (not in current types).

Replace all content in `components/portal/portal-project-tabs.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi, test, expect } from 'vitest'
import type { TrackerBoard } from '@/lib/types'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/portal/p1/overview'),
  useParams: vi.fn(() => ({ projectId: 'p1' })),
}))

const adoBoard: TrackerBoard = {
  id: 'b1', label: 'Alpha', type: 'ado',
  adoOrgUrl: '', adoProject: '', adoTeam: '', beadsRepo: '', beadsBranch: 'main',
}
const beadsBoard: TrackerBoard = {
  id: 'b2', label: 'Issues', type: 'beads',
  adoOrgUrl: '', adoProject: '', adoTeam: '', beadsRepo: 'repo', beadsBranch: 'main',
}

test('renders static tabs without boards', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[]} />)
  for (const label of ['Overview', 'Milestones', 'Documents', 'Links']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  expect(screen.queryByText('Status')).not.toBeInTheDocument()
})

test('renders board tab with board label', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[adoBoard]} />)
  expect(screen.getByText('Alpha')).toBeInTheDocument()
})

test('renders two board tabs for two boards', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[adoBoard, beadsBoard]} />)
  expect(screen.getByText('Alpha')).toBeInTheDocument()
  expect(screen.getByText('Issues')).toBeInTheDocument()
})

test('board tab links to /portal/[id]/boards/[boardId]', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[adoBoard]} />)
  const link = screen.getByRole('link', { name: 'Alpha' })
  expect(link).toHaveAttribute('href', '/portal/p1/boards/b1')
})

test('overview tab has aria-current when on overview path', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[]} />)
  expect(screen.getByRole('link', { name: /overview/i })).toHaveAttribute('aria-current', 'page')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- portal-project-tabs
```

Expected: "Status not in document" assertion fails (Status tab still exists).

- [ ] **Step 3: Rewrite the tabs component**

Replace all content in `components/portal/portal-project-tabs.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { TrackerBoard } from '@/lib/types'

const TABS_BEFORE_BOARDS = [
  { label: 'Overview',   segment: 'overview' },
  { label: 'Milestones', segment: 'milestones' },
]
const TABS_AFTER_BOARDS = [
  { label: 'Documents', segment: 'documents' },
  { label: 'Links',     segment: 'links' },
]

interface Props {
  projectId: string
  trackerBoards: TrackerBoard[]
}

export function PortalProjectTabs({ projectId, trackerBoards }: Props) {
  const pathname = usePathname()

  function tabClass(active: boolean) {
    return cn(
      'whitespace-nowrap px-4 py-3 font-mono text-[11px] uppercase tracking-[0.12em] border-b-2 -mb-px transition-colors',
      active
        ? 'border-[#fad542] text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground',
    )
  }

  function renderTab({ label, segment }: { label: string; segment: string }) {
    const href = `/portal/${projectId}/${segment}`
    const active = pathname.endsWith(`/${segment}`)
    return (
      <Link key={segment} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
        {label}
      </Link>
    )
  }

  return (
    <nav className="flex border-b overflow-x-auto">
      {TABS_BEFORE_BOARDS.map(renderTab)}
      {trackerBoards.map((board) => {
        const href = `/portal/${projectId}/boards/${board.id}`
        const active = pathname.includes(`/boards/${board.id}`)
        return (
          <Link key={board.id} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
            {board.label}
          </Link>
        )
      })}
      {TABS_AFTER_BOARDS.map(renderTab)}
    </nav>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass, including the updated tabs and overview tests.

- [ ] **Step 5: Commit**

```bash
git add components/portal/portal-project-tabs.tsx components/portal/portal-project-tabs.test.tsx
git commit -m "feat: restyle portal tabs with FortyAU brand, remove Status tab"
```
