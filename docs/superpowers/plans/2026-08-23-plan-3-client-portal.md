# Orbital — Plan 3: Client Portal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the read-only client portal — project selector, and five portal views (Overview, Status, Documents, ADO, Links) — visible only to users with the `viewer` role on a project.

**Architecture:** The `(client)` route group shares the same Firebase Auth and Firestore as the PM workspace. Viewers are added to a project's `members` map with role `'viewer'`; when added, their `users/{uid}` org mapping is also written so `useOrgId()` works on sign-in. The portal is entirely read-only — no writes anywhere. File downloads call `/api/files/download/[projectId]/[fileId]` which Plan 4 implements; in this plan the button is wired but the API route returns 501 until Plan 4.

**Tech Stack:** Next.js 15 App Router, Firestore, TanStack Query v5, shadcn/ui, Tailwind CSS, Vitest, @testing-library/react

**Prerequisites:** Plans 1 and 2 complete.

## Global Constraints

- All constraints from Plans 1 and 2 apply
- Portal is **read-only** — no write calls anywhere in `(client)` routes
- Files: only show `sharedWithClient: true` entries
- Risks / Issues: show `title`, `severity`, `description`, `status` only — omit `owner`
- Need From Client: show unresolved items only (`resolved: false`)
- ADO Board: show In Progress and Done sprint stories only — no backlog
- Status indicators are display-only — no dropdowns or edit controls
- Sign-out button present in portal nav

---

## File Map

```
app/(client)/
├── layout.tsx                              # Portal shell — sign-out + project name header
├── portal/
│   ├── page.tsx                            # Project selector (redirect if single project)
│   └── [projectId]/
│       ├── layout.tsx                      # Portal project shell + tab nav
│       ├── page.tsx                        # Redirect → /overview
│       ├── overview/page.tsx               # Name, description, tech stack, SOW summary, status header
│       ├── status/page.tsx                 # Metrics + Need From Client + Risks + Issues (read-only)
│       ├── documents/page.tsx              # Shared files — download only
│       ├── ado/page.tsx                    # Active sprint (filtered) + dev plan
│       └── links/page.tsx                  # Helpful links list
components/
└── portal/
    ├── portal-nav.tsx                      # Minimal top nav with sign-out
    └── portal-project-tabs.tsx            # 5-tab strip for portal workspace
```

---

### Task 1: Viewer Onboarding Fix + Portal Shell

**Context:** When a PM adds a viewer via `addMember`, the viewer's `users/{uid}` mapping must also be written so `useOrgId()` resolves when they sign in. This task patches `addMember` and builds the portal layout and nav.

**Files:**
- Modify: `lib/firestore/projects.ts` — call `setUserOrg` inside `addMember`
- Modify: `app/(client)/layout.tsx` — replace stub with portal shell
- Create: `components/portal/portal-nav.tsx`
- Create: `components/portal/portal-nav.test.tsx`

**Interfaces:**
- Consumes: `setUserOrg` from `lib/firestore/users`, `useAuth`, `/api/auth/signout`
- Produces: portal nav with sign-out; `addMember` now writes user-org mapping as a side effect

- [ ] **Step 1: Write failing nav test**

```typescript
// components/portal/portal-nav.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({ user: { displayName: 'Client User', email: 'client@example.com' } })),
}))
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))
global.fetch = vi.fn().mockResolvedValue({ ok: true })

test('renders Orbital branding and sign out button', async () => {
  const { PortalNav } = await import('./portal-nav')
  render(<PortalNav projectName="Alpha Project" />)
  expect(screen.getByText('Orbital')).toBeInTheDocument()
  expect(screen.getByText('Alpha Project')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/portal/portal-nav.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Patch `lib/firestore/projects.ts` — update `addMember`**

At the top of the file, add the import:
```typescript
import { setUserOrg } from './users'
```

In the `addMember` function body, after the `updateDoc` call, add:
```typescript
await setUserOrg(uid, orgId)
```

The full updated `addMember`:
```typescript
export async function addMember(
  orgId: string,
  projectId: string,
  uid: string,
  role: AccessLevel,
): Promise<void> {
  await updateDoc(doc(db, `orgs/${orgId}/projects/${projectId}`), {
    [`members.${uid}`]: role,
    updatedAt: serverTimestamp(),
  })
  await setUserOrg(uid, orgId)
}
```

- [ ] **Step 4: Create `components/portal/portal-nav.tsx`**

```typescript
'use client'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

interface Props { projectName?: string }

export function PortalNav({ projectName }: Props) {
  const { user } = useAuth()
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <header className="flex items-center justify-between border-b px-8 py-4">
      <div className="flex items-center gap-3">
        <span className="font-semibold text-lg">Orbital</span>
        {projectName && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">{projectName}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{user?.displayName ?? user?.email}</span>
        <Button variant="ghost" size="sm" className="gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Update `app/(client)/layout.tsx`**

```typescript
import { PortalNav } from '@/components/portal/portal-nav'

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <PortalNav />
      <main className="flex-1">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test components/portal/portal-nav.test.tsx
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/firestore/projects.ts app/(client)/layout.tsx \
  components/portal/portal-nav.tsx components/portal/portal-nav.test.tsx
git commit -m "feat: patch addMember to write user-org mapping; add portal nav and shell"
```

---

### Task 2: Project Selector + Portal Project Shell + Tabs

**Files:**
- Create: `app/(client)/portal/page.tsx`
- Create: `app/(client)/portal/[projectId]/layout.tsx`
- Create: `app/(client)/portal/[projectId]/page.tsx`
- Create: `components/portal/portal-project-tabs.tsx`
- Create: `components/portal/portal-project-tabs.test.tsx`

**Interfaces:**
- Consumes: `listProjects`, `useAuth`, `useOrgId`, `useProject`
- Produces: project selector that auto-redirects when user has exactly one project; portal tab strip with 5 tabs

- [ ] **Step 1: Write failing tab test**

```typescript
// components/portal/portal-project-tabs.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/portal/p1/status'),
  useParams: vi.fn(() => ({ projectId: 'p1' })),
}))

test('renders all five portal tabs', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" />)
  for (const label of ['Overview', 'Status', 'Documents', 'ADO', 'Links']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
})

test('active tab has aria-current', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" />)
  expect(screen.getByRole('link', { name: /status/i })).toHaveAttribute('aria-current', 'page')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/portal/portal-project-tabs.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/portal/portal-project-tabs.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Overview',   segment: 'overview' },
  { label: 'Status',     segment: 'status' },
  { label: 'Documents',  segment: 'documents' },
  { label: 'ADO',        segment: 'ado' },
  { label: 'Links',      segment: 'links' },
]

export function PortalProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  return (
    <nav className="flex border-b overflow-x-auto">
      {TABS.map(({ label, segment }) => {
        const href = `/portal/${projectId}/${segment}`
        const active = pathname.endsWith(`/${segment}`)
        return (
          <Link
            key={segment}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap px-4 py-3 text-sm border-b-2 -mb-px transition-colors',
              active
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Create `app/(client)/portal/page.tsx`**

```typescript
'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { listProjects } from '@/lib/firestore/projects'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function PortalSelectorPage() {
  const { user } = useAuth()
  const orgId = useOrgId()
  const router = useRouter()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['portal-projects', orgId, user?.uid],
    queryFn: () => listProjects(orgId!, user!.uid),
    enabled: !!orgId && !!user,
  })

  useEffect(() => {
    if (!isLoading && projects.length === 1) {
      router.replace(`/portal/${projects[0].id}/overview`)
    }
  }, [isLoading, projects, router])

  if (isLoading || projects.length === 1) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading…</div>
  }

  if (projects.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You have not been added to any projects yet.</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">Your Projects</h1>
      <div className="flex flex-col gap-3">
        {projects.map((p) => (
          <Card
            key={p.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => router.push(`/portal/${p.id}/overview`)}
          >
            <CardHeader>
              <CardTitle className="text-base">{p.name}</CardTitle>
              <CardDescription>{p.description || 'No description'}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(client)/portal/[projectId]/layout.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { PortalProjectTabs } from '@/components/portal/portal-project-tabs'

export default function PortalProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)

  return (
    <div className="flex flex-col">
      <div className="border-b px-8 pt-6 pb-0">
        <h1 className="text-xl font-semibold mb-4">{project?.name ?? '—'}</h1>
        <PortalProjectTabs projectId={projectId} />
      </div>
      <div className="p-8">{children}</div>
    </div>
  )
}
```

- [ ] **Step 6: Create `app/(client)/portal/[projectId]/page.tsx`**

```typescript
import { redirect } from 'next/navigation'

export default function PortalProjectIndexPage({ params }: { params: { projectId: string } }) {
  redirect(`/portal/${params.projectId}/overview`)
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test components/portal/portal-project-tabs.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add app/(client)/portal/ components/portal/portal-project-tabs.tsx components/portal/portal-project-tabs.test.tsx
git commit -m "feat: add portal project selector, shell layout, and tab navigation"
```

---

### Task 3: Portal Overview Page

**Files:**
- Create: `app/(client)/portal/[projectId]/overview/page.tsx`
- Create: `components/portal/portal-overview.test.tsx`

**Interfaces:**
- Consumes: `useProject`, `StatusBadge`
- Produces: read-only view of name, description, tech stack tags, SOW summary, status header

- [ ] **Step 1: Write failing test**

```typescript
// components/portal/portal-overview.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

const mockProject = {
  id: 'p1', orgId: 'o1', name: 'Alpha', description: 'Test project',
  techStack: ['React', 'Next.js'], pmTools: [], status: 'active' as const,
  adoOrgUrl: '', adoProject: '', adoTeam: '', adoPat: '',
  members: { uid1: 'viewer' as const },
  sow: { startDate: '2026-01-01', endDate: '2026-12-31', totalHours: 200, budgetHours: 180, summary: 'Build it.' },
  statusHeader: { scheduleStatus: 'on_track' as const, budgetStatus: 'at_risk' as const, scopeStatus: 'on_track' as const },
  createdBy: 'uid1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

vi.mock('@/hooks/use-org', () => ({ useOrgId: vi.fn(() => 'o1') }))
vi.mock('next/navigation', () => ({ useParams: vi.fn(() => ({ projectId: 'p1' })) }))
vi.mock('@/hooks/use-project', () => ({
  useProject: vi.fn(() => ({ data: mockProject })),
}))

test('renders project name, description, and tech stack', async () => {
  const Page = (await import('@/app/(client)/portal/[projectId]/overview/page')).default
  render(<Page />)
  expect(screen.getByText('Alpha')).toBeInTheDocument()
  expect(screen.getByText('Test project')).toBeInTheDocument()
  expect(screen.getByText('React')).toBeInTheDocument()
})

test('renders SOW summary', async () => {
  const Page = (await import('@/app/(client)/portal/[projectId]/overview/page')).default
  render(<Page />)
  expect(screen.getByText('Build it.')).toBeInTheDocument()
})

test('renders status badges for all three indicators', async () => {
  const Page = (await import('@/app/(client)/portal/[projectId]/overview/page')).default
  render(<Page />)
  expect(screen.getAllByText('On Track').length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText('At Risk')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/portal/portal-overview.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/(client)/portal/[projectId]/overview/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { StatusBadge } from '@/components/status/status-badge'
import { Badge } from '@/components/ui/badge'

export default function PortalOverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <section>
        <h2 className="text-2xl font-semibold">{project.name}</h2>
        {project.description && <p className="mt-2 text-muted-foreground">{project.description}</p>}
        {project.techStack.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {project.techStack.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
          </div>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-3">Engagement Summary</h3>
        <div className="border rounded-md p-4 flex flex-col gap-2 text-sm">
          {project.sow.summary && <p>{project.sow.summary}</p>}
          <div className="grid grid-cols-2 gap-2 mt-2 text-muted-foreground">
            <span>Start: <strong className="text-foreground">{project.sow.startDate || '—'}</strong></span>
            <span>End: <strong className="text-foreground">{project.sow.endDate || '—'}</strong></span>
          </div>
        </div>
      </section>

      <section>
        <h3 className="font-semibold mb-3">Project Status</h3>
        <div className="grid grid-cols-3 gap-4">
          {(
            [
              { label: 'Schedule', field: 'scheduleStatus' },
              { label: 'Budget',   field: 'budgetStatus' },
              { label: 'Scope',    field: 'scopeStatus' },
            ] as const
          ).map(({ label, field }) => (
            <div key={field} className="border rounded-md p-4 flex flex-col gap-2">
              <p className="text-sm font-medium">{label}</p>
              <StatusBadge status={project.statusHeader[field]} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test components/portal/portal-overview.test.tsx
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(client)/portal/[projectId]/overview/ components/portal/portal-overview.test.tsx
git commit -m "feat: add portal overview page"
```

---

### Task 4: Portal Status Page

**Files:**
- Create: `app/(client)/portal/[projectId]/status/page.tsx`

**Interfaces:**
- Consumes: `useProject`, `listRisks`, `listIssues`, `listClientActions`, `StatusBadge`
- Produces: read-only metrics + unresolved client actions + open risks/issues (no owner shown)

- [ ] **Step 1: Create `app/(client)/portal/[projectId]/status/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listRisks } from '@/lib/firestore/risks'
import { listIssues } from '@/lib/firestore/issues'
import { listClientActions } from '@/lib/firestore/client-actions'
import { StatusBadge } from '@/components/status/status-badge'
import { Badge } from '@/components/ui/badge'

const SEVERITY_COLOR: Record<string, string> = {
  low: 'bg-blue-50 text-blue-700 border-blue-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  high: 'bg-red-50 text-red-700 border-red-200',
}

function schedulePercent(sow: { startDate: string; endDate: string }): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))
}

export default function PortalStatusPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const enabled = !!orgId

  const { data: risks = [] } = useQuery({
    queryKey: ['risks', orgId, projectId],
    queryFn: () => listRisks(orgId!, projectId),
    enabled,
  })
  const { data: issues = [] } = useQuery({
    queryKey: ['issues', orgId, projectId],
    queryFn: () => listIssues(orgId!, projectId),
    enabled,
  })
  const { data: clientActions = [] } = useQuery({
    queryKey: ['clientActions', orgId, projectId],
    queryFn: () => listClientActions(orgId!, projectId),
    enabled,
  })

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const schedule = schedulePercent(project.sow)
  const openRisks = risks.filter((r) => r.status === 'open')
  const openIssues = issues.filter((i) => i.status === 'open')
  const unresolvedActions = clientActions.filter((a) => !a.resolved)

  return (
    <div className="max-w-3xl flex flex-col gap-8">
      {/* Metrics */}
      <section>
        <h2 className="font-semibold mb-4">Status Overview</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          {(
            [
              { label: 'Schedule', field: 'scheduleStatus' },
              { label: 'Budget',   field: 'budgetStatus' },
              { label: 'Scope',    field: 'scopeStatus' },
            ] as const
          ).map(({ label, field }) => (
            <div key={field} className="border rounded-md p-3 flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <StatusBadge status={project.statusHeader[field]} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded-md p-4">
            <p className="text-xs text-muted-foreground">Schedule</p>
            <p className="text-2xl font-semibold">{schedule}%</p>
            <p className="text-xs text-muted-foreground">days elapsed</p>
          </div>
          <div className="border rounded-md p-4">
            <p className="text-xs text-muted-foreground">Engagement</p>
            <p className="text-sm font-medium">{project.sow.startDate || '—'}</p>
            <p className="text-xs text-muted-foreground">to {project.sow.endDate || '—'}</p>
          </div>
          <div className="border rounded-md p-4">
            <p className="text-xs text-muted-foreground">Scope</p>
            <p className="text-2xl font-semibold">—</p>
            <p className="text-xs text-muted-foreground">from ADO (Plan 4)</p>
          </div>
        </div>
      </section>

      {/* Need From Client */}
      {unresolvedActions.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3">Action Required</h3>
          <ul className="flex flex-col gap-2">
            {unresolvedActions.map((a) => (
              <li key={a.id} className="border rounded-md px-4 py-3 text-sm">
                <p className="font-medium">{a.stakeholderName}</p>
                <p className="text-muted-foreground">{a.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Risks */}
      {openRisks.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3">Open Risks</h3>
          <ul className="flex flex-col gap-2">
            {openRisks.map((r) => (
              <li key={r.id} className="border rounded-md px-4 py-3 text-sm flex items-start gap-3">
                <Badge variant="outline" className={SEVERITY_COLOR[r.severity]}>{r.severity}</Badge>
                <div>
                  <p className="font-medium">{r.title}</p>
                  {r.description && <p className="text-muted-foreground">{r.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Issues */}
      {openIssues.length > 0 && (
        <section>
          <h3 className="font-semibold mb-3">Open Issues</h3>
          <ul className="flex flex-col gap-2">
            {openIssues.map((i) => (
              <li key={i.id} className="border rounded-md px-4 py-3 text-sm flex items-start gap-3">
                <Badge variant="outline" className={SEVERITY_COLOR[i.severity]}>{i.severity}</Badge>
                <div>
                  <p className="font-medium">{i.title}</p>
                  {i.description && <p className="text-muted-foreground">{i.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {unresolvedActions.length === 0 && openRisks.length === 0 && openIssues.length === 0 && (
        <p className="text-muted-foreground text-sm">No open items at this time.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(client)/portal/[projectId]/status/
git commit -m "feat: add portal status page (read-only metrics, risks, issues, client actions)"
```

---

### Task 5: Portal Documents Page

**Files:**
- Create: `app/(client)/portal/[projectId]/documents/page.tsx`

**Interfaces:**
- Consumes: `listFiles` from `lib/firestore/files` — filters to `sharedWithClient: true`
- Produces: downloadable file list; download calls `/api/files/download/[projectId]/[fileId]` (Plan 4)

- [ ] **Step 1: Create `app/(client)/portal/[projectId]/documents/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { listFiles } from '@/lib/firestore/files'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

export default function PortalDocumentsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: allFiles = [], isLoading } = useQuery({
    queryKey: ['files', orgId, projectId],
    queryFn: () => listFiles(orgId!, projectId),
    enabled: !!orgId,
  })

  const sharedFiles = allFiles.filter((f) => f.sharedWithClient)

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl">
      <h2 className="font-semibold mb-4">Shared Documents</h2>

      {sharedFiles.length === 0 && (
        <p className="text-muted-foreground text-sm">No documents have been shared with you yet.</p>
      )}

      <ul className="flex flex-col gap-3">
        {sharedFiles.map((f) => (
          <li key={f.id} className="flex items-center justify-between border rounded-md px-4 py-3">
            <div>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {f.mimeType} · {(f.sizeBytes / 1024).toFixed(0)} KB · {f.uploadedAt?.slice(0, 10) ?? '—'}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => window.open(`/api/files/download/${projectId}/${f.id}`, '_blank')}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(client)/portal/[projectId]/documents/
git commit -m "feat: add portal documents page (shared files, download wired to Plan 4 API)"
```

---

### Task 6: Portal ADO View + Helpful Links

**Files:**
- Create: `app/(client)/portal/[projectId]/ado/page.tsx`
- Create: `app/(client)/portal/[projectId]/links/page.tsx`

**Interfaces:**
- ADO page: consumes `getLatestCache` — shows In Progress and Done sprint stories + dev plan iterations
- Links page: consumes `listHelpfulLinks` — renders all links as a clean list

- [ ] **Step 1: Create `app/(client)/portal/[projectId]/ado/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'

const VISIBLE_STATES = ['In Progress', 'Done']

export default function PortalAdoPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const enabled = !!orgId

  const { data: sprintCache, isLoading: sprintLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'sprint'],
    queryFn: () => getLatestCache(orgId!, projectId, 'sprint'),
    enabled,
  })

  const { data: devPlanCache, isLoading: planLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'devplan'],
    queryFn: () => getLatestCache(orgId!, projectId, 'devplan'),
    enabled,
  })

  if (sprintLoading || planLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!sprintCache && !devPlanCache) {
    return <p className="text-muted-foreground">ADO data not yet available.</p>
  }

  const sprintItems = ((sprintCache?.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]
  const visibleItems = sprintItems.filter((i) => VISIBLE_STATES.includes(String(i['state'] ?? '')))

  const iterations = ((devPlanCache?.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]

  return (
    <div className="flex flex-col gap-10">
      {/* Active Sprint — In Progress + Done only */}
      <section>
        <h2 className="font-semibold mb-4">Active Sprint</h2>
        {visibleItems.length === 0 && (
          <p className="text-muted-foreground text-sm">No in-progress or completed stories in the current sprint.</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          {VISIBLE_STATES.map((col) => (
            <div key={col} className="border rounded-md p-4">
              <p className="font-medium text-sm mb-3">{col}</p>
              <div className="flex flex-col gap-2">
                {visibleItems
                  .filter((i) => i['state'] === col)
                  .map((i, idx) => (
                    <div key={idx} className="text-xs border rounded p-2 bg-muted/30">
                      {String(i['title'] ?? i['id'] ?? idx)}
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Development Plan */}
      {iterations.length > 0 && (
        <section>
          <h2 className="font-semibold mb-4">Development Plan</h2>
          <table className="w-full text-sm border rounded-md overflow-hidden">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2">Milestone</th>
                <th className="text-left p-2">Start</th>
                <th className="text-left p-2">Target</th>
              </tr>
            </thead>
            <tbody>
              {iterations.map((it, idx) => {
                const attrs = it['attributes'] as Record<string, unknown> | undefined
                return (
                  <tr key={idx} className="border-t">
                    <td className="p-2">{String(it['name'] ?? idx)}</td>
                    <td className="p-2">{String(attrs?.['startDate'] ?? '—').slice(0, 10)}</td>
                    <td className="p-2">{String(attrs?.['finishDate'] ?? '—').slice(0, 10)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(client)/portal/[projectId]/links/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { listHelpfulLinks } from '@/lib/firestore/helpful-links'
import { ExternalLink } from 'lucide-react'

export default function PortalLinksPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links', orgId, projectId],
    queryFn: () => listHelpfulLinks(orgId!, projectId),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-xl">
      <h2 className="font-semibold mb-4">Helpful Links</h2>
      {links.length === 0 && (
        <p className="text-muted-foreground text-sm">No links have been added yet.</p>
      )}
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(client)/portal/[projectId]/ado/ app/(client)/portal/[projectId]/links/
git commit -m "feat: add portal ADO view (filtered sprint + dev plan) and helpful links page"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Viewer-only route group `(client)` | Task 1 (layout) |
| Viewer `users/{uid}` mapping written on addMember | Task 1 (projects.ts patch) |
| Project selector — auto-redirect if single project | Task 2 |
| Project selector — picker for multiple projects | Task 2 |
| Portal overview: name, description, tech stack | Task 3 |
| Portal overview: SOW summary + dates | Task 3 |
| Portal overview: status header (read-only) | Task 3 |
| Portal status: schedule %, budget, scope metrics | Task 4 |
| Portal status: Need From Client (unresolved only) | Task 4 |
| Portal status: open risks — no owner shown | Task 4 |
| Portal status: open issues — no owner shown | Task 4 |
| Shared documents — `sharedWithClient: true` only | Task 5 |
| Download only, no upload | Task 5 |
| ADO board — In Progress and Done only | Task 6 |
| Development plan — iterations + dates | Task 6 |
| No raw backlog visible to clients | Task 6 (VISIBLE_STATES filter) |
| Helpful links list | Task 6 |
| Sign-out in portal nav | Task 1 |

**Placeholder scan:** Download button in Task 5 calls `/api/files/download/[projectId]/[fileId]` — this is intentional; Plan 4 implements the API route. ADO scope metric on status page shows "—" stub — intentional until Plan 4.

**Type consistency:** All types match Plan 1 definitions. `sharedWithClient: boolean` matches `ProjectFile`. `VISIBLE_STATES` filter uses ADO-returned state strings — matches Plan 4's ADO REST response shape documented in the spec.

**Security note:** Firestore rules (Plan 1) enforce viewer read-only at the database level. These portal pages contain no write calls — defence in depth.
