# PDF Export — Client Portal Report — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a print-optimized report page at `/portal/[projectId]/report` and an "Export PDF" button in the portal tabs that opens it in a new tab.

**Architecture:** A new client page fetches the same data as the portal overview (project, risks, milestones) via existing hooks/queries. It renders a paper-friendly layout — replacing circular SVG rings with simple progress bars, dropping charts — with a `@page` CSS rule for A4 sizing and a `print:hidden` Print button. The portal tabs get a right-aligned "Export PDF" link with `target="_blank"`.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, @tanstack/react-query, Firebase/Firestore (via existing hooks), Vitest + @testing-library/react

## Global Constraints

- No new npm dependencies — use only what's already installed
- All colors must use explicit hex values (not Tailwind dark-mode classes) — the print layout is always light/white
- `print:hidden` on any element that should not appear in the PDF
- `break-before-page` on Risks and Milestones sections to prevent mid-section page splits
- `@page { size: A4; margin: 20mm; }` injected via `<style>` tag in the report page
- Tests use vitest + @testing-library/react; mock all hooks and react-query

---

### Task 1: Build the report page

**Files:**
- Create: `app/(client)/portal/[projectId]/report/page.tsx`
- Create: `app/(client)/portal/[projectId]/report/page.test.tsx`

**Interfaces:**
- Consumes: `useProject(orgId, projectId)` → `Project | undefined`, `useOrgId()` → `string | null`, `useParams()` → `{ projectId: string }`, `useQuery` with `listRisks(orgId, projectId)` → `Risk[]`, `listMilestones(orgId, projectId)` → `Milestone[]`
- Produces: default export `PortalReportPage` — Next.js page component

- [ ] **Step 1: Write the failing test**

Create `app/(client)/portal/[projectId]/report/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import type { Risk, Milestone } from '@/lib/types'

const mockProject = {
  id: 'p1', orgId: 'o1', name: 'Quattro', description: 'Platform project',
  techStack: ['React', 'Next.js'], pmTools: [], status: 'active' as const,
  trackerBoards: [], members: { uid1: 'owner' as const },
  sow: { startDate: '2026-01-01', endDate: '2026-12-31', totalHours: 500, summary: 'Build it.' },
  statusHeader: {
    scheduleStatus: 'on_track' as const,
    budgetStatus: 'at_risk' as const,
    scopeStatus: 'on_track' as const,
  },
  hoursUsed: 200,
  createdBy: 'uid1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

const mockRisks: Risk[] = [
  {
    id: 'r1', title: 'Scope creep', severity: 'high', description: 'Growing requirements.',
    status: 'open', owner: '', createdAt: '', updatedAt: '',
  },
  {
    id: 'r2', title: 'Old risk', severity: 'low', description: '',
    status: 'resolved', owner: '', createdAt: '', updatedAt: '',
  },
]

const mockMilestones: Milestone[] = [
  {
    id: 'm1', name: 'Alpha Release', status: 'in_progress',
    startDate: '2026-02-01', endDate: '2026-03-01',
    history: [], createdAt: '', updatedAt: '', createdBy: '',
  },
]

vi.mock('@/lib/firebase/client', () => ({ auth: {}, db: {}, storage: {} }))
vi.mock('@/lib/firestore/risks', () => ({ listRisks: vi.fn() }))
vi.mock('@/lib/firestore/milestones', () => ({ listMilestones: vi.fn() }))
vi.mock('@/lib/firestore/ado-cache', () => ({ getLatestBoardCache: vi.fn() }))
vi.mock('@/hooks/use-org', () => ({ useOrgId: vi.fn(() => 'o1') }))
vi.mock('next/navigation', () => ({ useParams: vi.fn(() => ({ projectId: 'p1' })) }))
vi.mock('@/hooks/use-project', () => ({ useProject: vi.fn(() => ({ data: mockProject })) }))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'risks')      return { data: mockRisks }
      if (queryKey[0] === 'milestones') return { data: mockMilestones }
      return { data: undefined }
    }),
  }
})

describe('PortalReportPage', () => {
  let Page: React.ComponentType

  beforeEach(async () => {
    Page = (await import('./page')).default
  })

  test('renders project name and description', () => {
    render(<Page />)
    expect(screen.getByText('Quattro')).toBeInTheDocument()
    expect(screen.getByText('Platform project')).toBeInTheDocument()
  })

  test('renders FortyAU header and report label', () => {
    render(<Page />)
    expect(screen.getByText('FortyAU')).toBeInTheDocument()
    expect(screen.getByText(/project status report/i)).toBeInTheDocument()
  })

  test('renders schedule and budget metric blocks', () => {
    render(<Page />)
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  test('renders budget detail line: 200 of 500 hrs', () => {
    render(<Page />)
    expect(screen.getByText(/200 of 500 hrs/i)).toBeInTheDocument()
  })

  test('renders only open risks', () => {
    render(<Page />)
    expect(screen.getByText('Scope creep')).toBeInTheDocument()
    expect(screen.queryByText('Old risk')).not.toBeInTheDocument()
  })

  test('renders milestone name and status', () => {
    render(<Page />)
    expect(screen.getByText('Alpha Release')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  test('renders Print button', () => {
    render(<Page />)
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run app/\(client\)/portal/\[projectId\]/report/page.test.tsx
```

Expected: FAIL — module `./page` not found.

- [ ] **Step 3: Implement the report page**

Create `app/(client)/portal/[projectId]/report/page.tsx`:

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listRisks } from '@/lib/firestore/risks'
import { listMilestones } from '@/lib/firestore/milestones'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import type { StatusLevel, MilestoneStatus } from '@/lib/types'

function schedulePercent(sow: { startDate: string; endDate: string }): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  if (end - start <= 0) return 0
  return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))
}

function scheduleDays(sow: { startDate: string; endDate: string }): { elapsed: number; total: number } {
  if (!sow.startDate || !sow.endDate) return { elapsed: 0, total: 0 }
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  if (end - start <= 0) return { elapsed: 0, total: 0 }
  const total = Math.round((end - start) / 86_400_000)
  const elapsed = Math.min(total, Math.max(0, Math.round((Date.now() - start) / 86_400_000)))
  return { elapsed, total }
}

const STATUS_LABEL: Record<StatusLevel, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  off_track: 'Off Track',
}

const STATUS_BAR_COLOR: Record<StatusLevel, string> = {
  on_track: '#16a34a',
  at_risk: '#d97706',
  off_track: '#dc2626',
}

const SEVERITY_COLOR: Record<string, string> = {
  low:    'bg-blue-100 text-blue-800 border-blue-200',
  medium: 'bg-amber-100 text-amber-800 border-amber-200',
  high:   'bg-red-100 text-red-800 border-red-200',
}

const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  completed:   'Completed',
}

const MILESTONE_STATUS_CLASS: Record<MilestoneStatus, string> = {
  not_started: 'bg-gray-100 text-gray-600 border-gray-200',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
  blocked:     'bg-red-100 text-red-800 border-red-200',
  completed:   'bg-green-100 text-green-800 border-green-200',
}

function MetricBlock({
  label, percent, status, detail,
}: {
  label: string
  percent: number
  status: StatusLevel
  detail: string
}) {
  const barColor = STATUS_BAR_COLOR[status]
  return (
    <div className="border border-gray-200 rounded-md p-5">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{label}</p>
      <p className="text-4xl font-bold text-gray-900 mb-3">{percent}%</p>
      <div className="h-2 bg-gray-100 rounded-full mb-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: barColor }} />
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: barColor }}>{STATUS_LABEL[status]}</p>
      <p className="text-xs text-gray-500">{detail}</p>
    </div>
  )
}

export default function PortalReportPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const enabled = !!orgId

  const { data: risks = [] } = useQuery({
    queryKey: ['risks', orgId, projectId],
    queryFn: () => listRisks(orgId!, projectId),
    enabled,
  })
  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', orgId, projectId],
    queryFn: () => listMilestones(orgId!, projectId),
    enabled,
  })

  if (!project) return <p className="text-gray-400 p-8">Loading…</p>

  const schedulePct = schedulePercent(project.sow)
  const { elapsed: daysElapsed, total: totalDays } = scheduleDays(project.sow)
  const hoursConsumed = project.hoursUsed ?? 0
  const budgetPct = project.sow.totalHours
    ? Math.min(100, Math.round((hoursConsumed / project.sow.totalHours) * 100))
    : 0
  const openRisks = risks.filter((r) => r.status === 'open')
  const sortedMilestones = [...milestones].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <style>{`@page { size: A4; margin: 20mm; }`}</style>

      <div className="max-w-4xl mx-auto px-8 py-8">
        {/* Print button — hidden when printing */}
        <div className="print:hidden flex justify-end mb-6">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>

        {/* Header band */}
        <header className="flex items-center justify-between pb-4 mb-8 border-b border-gray-200">
          <span className="text-lg font-bold tracking-tight text-gray-900">FortyAU</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Project Status Report</span>
          <span className="text-sm text-gray-500">{generatedDate}</span>
        </header>

        {/* Project block */}
        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-gray-600 mb-3">{project.description}</p>
          )}
          {project.techStack.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {project.techStack.map((t) => (
                <Badge key={t} variant="secondary">{t}</Badge>
              ))}
            </div>
          )}
          <p className="font-mono text-xs text-gray-500 mb-2">
            {project.sow.startDate || '—'} → {project.sow.endDate || '—'}
          </p>
          {project.sow.summary && (
            <p className="text-sm text-gray-600">{project.sow.summary}</p>
          )}
        </section>

        {/* Metrics */}
        <section className="grid grid-cols-2 gap-6 mb-10">
          <MetricBlock
            label="Schedule"
            percent={schedulePct}
            status={project.statusHeader.scheduleStatus}
            detail={totalDays ? `${daysElapsed} of ${totalDays} days` : 'No dates set'}
          />
          <MetricBlock
            label="Budget"
            percent={budgetPct}
            status={project.statusHeader.budgetStatus}
            detail={project.sow.totalHours ? `${hoursConsumed} of ${project.sow.totalHours} hrs` : 'No budget set'}
          />
        </section>

        {/* Risks */}
        <section className="mb-10 break-before-page">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Risks</h3>
          {openRisks.length === 0 ? (
            <p className="text-sm text-gray-500">No open risks.</p>
          ) : (
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500 w-28">Severity</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Risk</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Description</th>
                </tr>
              </thead>
              <tbody>
                {openRisks.map((r, i) => (
                  <tr key={r.id} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={SEVERITY_COLOR[r.severity] ?? ''}>
                        {r.severity.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{r.title}</td>
                    <td className="px-4 py-2 text-gray-600">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Milestones */}
        {sortedMilestones.length > 0 && (
          <section className="mb-10 break-before-page">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">Milestones</h3>
            <table className="w-full text-sm border border-gray-200 rounded-md overflow-hidden">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Milestone</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">Start</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-500">End</th>
                </tr>
              </thead>
              <tbody>
                {sortedMilestones.map((m, i) => (
                  <tr key={m.id} className={i % 2 === 0 ? '' : 'bg-gray-50/50'}>
                    <td className="px-4 py-2 font-medium text-gray-900">{m.name}</td>
                    <td className="px-4 py-2">
                      <Badge variant="outline" className={MILESTONE_STATUS_CLASS[m.status]}>
                        {MILESTONE_STATUS_LABEL[m.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{m.startDate}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">{m.endDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Footer — visible only when printing */}
        <footer className="hidden print:block mt-12 pt-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Confidential · Generated {generatedDate} · Orbital</p>
        </footer>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/\(client\)/portal/\[projectId\]/report/page.test.tsx
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(client)/portal/[projectId]/report/page.tsx" "app/(client)/portal/[projectId]/report/page.test.tsx"
git commit -m "feat: add print-optimized portal report page"
```

---

### Task 2: Add Export PDF button to portal tabs

**Files:**
- Modify: `components/portal/portal-project-tabs.tsx`
- Modify: `components/portal/portal-project-tabs.test.tsx`

**Interfaces:**
- Consumes: `projectId: string` prop (existing)
- Produces: renders an `<a>` link to `/portal/${projectId}/report` with `target="_blank"`, text "Export PDF"

- [ ] **Step 1: Add the failing test**

Add this test to `components/portal/portal-project-tabs.test.tsx` (append after the existing tests):

```tsx
test('renders Export PDF link pointing to the report route in a new tab', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[]} />)
  const link = screen.getByRole('link', { name: /export pdf/i })
  expect(link).toHaveAttribute('href', '/portal/p1/report')
  expect(link).toHaveAttribute('target', '_blank')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run components/portal/portal-project-tabs.test.tsx
```

Expected: FAIL — no link with name "Export PDF" found.

- [ ] **Step 3: Add Export PDF link to portal tabs**

Replace the contents of `components/portal/portal-project-tabs.tsx`:

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Printer } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TrackerBoard } from '@/lib/types'

const STATIC_TABS = [
  { label: 'Overview',  segment: 'overview'  },
  { label: 'Documents', segment: 'documents' },
  { label: 'Links',     segment: 'links'     },
]

export function PortalProjectTabs({
  projectId,
  trackerBoards = [],
}: {
  projectId: string
  trackerBoards?: TrackerBoard[]
}) {
  const pathname = usePathname()

  function tabClass(active: boolean) {
    return cn(
      'whitespace-nowrap px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
      active
        ? 'border-primary font-medium text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground',
    )
  }

  return (
    <nav className="flex items-center justify-between border-b">
      <div className="flex">
        {STATIC_TABS.map(({ label, segment }) => {
          const href = `/portal/${projectId}/${segment}`
          const active = pathname.endsWith(`/${segment}`)
          return (
            <Link key={segment} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
              {label}
            </Link>
          )
        })}
        {trackerBoards.map((board) => {
          const href = `/portal/${projectId}/boards/${board.id}`
          const active = pathname.includes(`/boards/${board.id}`)
          return (
            <Link key={board.id} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
              {board.label}
            </Link>
          )
        })}
      </div>
      <Link
        href={`/portal/${projectId}/report`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-3 py-2 mb-px text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Printer className="h-3.5 w-3.5" />
        Export PDF
      </Link>
    </nav>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run components/portal/portal-project-tabs.test.tsx
```

Expected: All tests PASS (including the new Export PDF test and the pre-existing board tab tests).

- [ ] **Step 5: Commit**

```bash
git add components/portal/portal-project-tabs.tsx components/portal/portal-project-tabs.test.tsx
git commit -m "feat: add Export PDF button to portal project tabs"
```
