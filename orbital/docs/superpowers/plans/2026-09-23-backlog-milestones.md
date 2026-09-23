# Backlog Status & Description for Milestones Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `backlog` status and markdown `description` field to milestones so PMs can capture unscheduled ideas in the same data model, promote them to scheduled milestones by adding dates, and view them in a dedicated section with rendered markdown.

**Architecture:** `'backlog'` is added to the `MilestoneStatus` union; `Milestone` gains an optional `description` and optional dates. The milestones page splits items into a scheduled list (Gantt + existing table) and a new backlog section (cards with rendered markdown). `BacklogItemCard` enforces the date gate before allowing status promotion. `MarkdownBody` wraps `react-markdown` for reuse.

**Tech Stack:** React, Next.js App Router, Firebase Firestore, Tailwind CSS v4, `react-markdown`, `@tailwindcss/typography`, Vitest + Testing Library

## Global Constraints

- Tailwind CSS v4 — plugins are added via `@plugin "..."` in `app/globals.css`, **not** in a config file
- Test with `npx vitest run` — config is in `vitest.config.mts`
- All imports use `@/` alias (maps to repo root)
- Firebase is mocked in tests via `vi.mock('firebase/firestore', ...)` and `vi.mock('@/lib/firebase/client', ...)`
- No rich-text editor — plain `<textarea>` for input, `react-markdown` for rendered output
- Dates are never cleared when demoting a milestone to backlog

---

### Task 1: Install dependencies and configure typography

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `app/globals.css`

**Interfaces:**
- Produces: `prose` Tailwind classes available globally; `react-markdown` importable

- [ ] **Step 1: Install packages**

```bash
npm install react-markdown @tailwindcss/typography
```

- [ ] **Step 2: Add typography plugin to globals.css**

Open `app/globals.css`. After `@import "tailwindcss";` on line 1, add:

```css
@plugin "@tailwindcss/typography";
```

The top of the file should now read:
```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
```

- [ ] **Step 3: Verify build compiles**

```bash
npx next build 2>&1 | tail -5
```

Expected: build succeeds (exit 0). If it fails due to the typography plugin, verify `@tailwindcss/typography` is listed in `node_modules/@tailwindcss/typography/package.json`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/globals.css
git commit -m "chore: install react-markdown and @tailwindcss/typography"
```

---

### Task 2: Update types and Firestore layer

**Files:**
- Modify: `lib/types.ts` (lines 170–188)
- Modify: `lib/firestore/milestones.ts`
- Modify: `docs/firestore-data-model.md`
- Modify: `lib/types.test.ts`
- Create: `lib/firestore/milestones.test.ts`

**Interfaces:**
- Consumes: nothing (foundation task)
- Produces:
  - `MilestoneStatus = 'backlog' | 'not_started' | 'in_progress' | 'blocked' | 'completed'`
  - `Milestone.description?: string`
  - `Milestone.startDate?: string`, `Milestone.endDate?: string`
  - `addMilestone(orgId, projectId, { name, status, startDate?, endDate?, description?, createdBy }): Promise<string>`
  - `updateMilestone(orgId, projectId, id, { name?, startDate?, endDate?, description? }): Promise<void>`

- [ ] **Step 1: Write failing type tests**

Append to `lib/types.test.ts`:

```ts
test('MilestoneStatus includes backlog', () => {
  const s: import('./types').MilestoneStatus = 'backlog'
  expect(s).toBe('backlog')
})

test('Milestone allows optional startDate endDate and description', () => {
  const m: import('./types').Milestone = {
    id: 'm1',
    name: 'Research spike',
    status: 'backlog',
    history: [],
    createdAt: '2026-09-23T00:00:00Z',
    updatedAt: '2026-09-23T00:00:00Z',
    createdBy: 'uid1',
  }
  expect(m.startDate).toBeUndefined()
  expect(m.endDate).toBeUndefined()
  expect(m.description).toBeUndefined()
})
```

- [ ] **Step 2: Create failing Firestore milestone tests**

Create `lib/firestore/milestones.test.ts`:

```ts
import { vi } from 'vitest'

const mockAddDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockUpdateDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockArrayUnion = vi.fn((entry) => [entry])

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: vi.fn(() => 'TS'),
  arrayUnion: mockArrayUnion,
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('addMilestone with backlog status stores no dates', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'new-id' })
  const { addMilestone } = await import('./milestones')
  const id = await addMilestone('org1', 'proj1', { name: 'Idea', status: 'backlog', createdBy: 'uid1' })
  expect(id).toBe('new-id')
  const payload = mockAddDoc.mock.calls[0][1]
  expect(payload.name).toBe('Idea')
  expect(payload.status).toBe('backlog')
  expect(payload.startDate).toBeUndefined()
  expect(payload.endDate).toBeUndefined()
})

test('addMilestone with not_started status stores dates', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'ms-id' })
  const { addMilestone } = await import('./milestones')
  await addMilestone('org1', 'proj1', {
    name: 'Ship v1',
    status: 'not_started',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    createdBy: 'uid1',
  })
  const payload = mockAddDoc.mock.calls[0][1]
  expect(payload.startDate).toBe('2026-10-01')
  expect(payload.endDate).toBe('2026-10-31')
})

test('addMilestone stores description when provided', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'id1' })
  const { addMilestone } = await import('./milestones')
  await addMilestone('org1', 'proj1', {
    name: 'Spike',
    status: 'backlog',
    description: '## Goals\n\nDefine scope.',
    createdBy: 'uid1',
  })
  const payload = mockAddDoc.mock.calls[0][1]
  expect(payload.description).toBe('## Goals\n\nDefine scope.')
})

test('updateMilestone passes description to Firestore', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockUpdateDoc.mockResolvedValue(undefined)
  const { updateMilestone } = await import('./milestones')
  await updateMilestone('org1', 'proj1', 'ms-1', { description: '## Updated\n\nNew notes.' })
  const payload = mockUpdateDoc.mock.calls[0][1]
  expect(payload.description).toBe('## Updated\n\nNew notes.')
  expect(payload.updatedAt).toBe('TS')
})
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run lib/types.test.ts lib/firestore/milestones.test.ts
```

Expected: failures on the new tests (type errors or import errors).

- [ ] **Step 4: Update MilestoneStatus and Milestone in lib/types.ts**

Replace the `MilestoneStatus` type and `Milestone` interface (currently lines 170–188):

```ts
export type MilestoneStatus = 'backlog' | 'not_started' | 'in_progress' | 'blocked' | 'completed'

export interface MilestoneHistoryEntry {
  timestamp: string
  fromStatus: MilestoneStatus | null
  toStatus: MilestoneStatus
}

export interface Milestone {
  id: string
  name: string
  status: MilestoneStatus
  startDate?: string
  endDate?: string
  description?: string
  history: MilestoneHistoryEntry[]
  createdAt: string
  updatedAt: string
  createdBy: string
}
```

- [ ] **Step 5: Update lib/firestore/milestones.ts**

Replace the full file contents:

```ts
import { collection, doc, addDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Milestone, MilestoneStatus, MilestoneHistoryEntry } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/milestones`

export async function listMilestones(orgId: string, projectId: string): Promise<Milestone[]> {
  const snap = await getDocs(collection(db, path(orgId, projectId)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Milestone)
}

export async function addMilestone(
  orgId: string,
  projectId: string,
  data: {
    name: string
    status: MilestoneStatus
    startDate?: string
    endDate?: string
    description?: string
    createdBy: string
  },
): Promise<string> {
  const ref = await addDoc(collection(db, path(orgId, projectId)), {
    ...data,
    history: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateMilestone(
  orgId: string,
  projectId: string,
  id: string,
  data: { name?: string; startDate?: string; endDate?: string; description?: string },
): Promise<void> {
  await updateDoc(doc(db, path(orgId, projectId), id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function updateMilestoneStatus(
  orgId: string,
  projectId: string,
  id: string,
  fromStatus: MilestoneStatus,
  toStatus: MilestoneStatus,
): Promise<void> {
  const entry: MilestoneHistoryEntry = {
    timestamp: new Date().toISOString(),
    fromStatus,
    toStatus,
  }
  await updateDoc(doc(db, path(orgId, projectId), id), {
    status: toStatus,
    updatedAt: serverTimestamp(),
    history: arrayUnion(entry),
  })
}

export async function deleteMilestone(orgId: string, projectId: string, id: string): Promise<void> {
  await deleteDoc(doc(db, path(orgId, projectId), id))
}
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
npx vitest run lib/types.test.ts lib/firestore/milestones.test.ts
```

Expected: all tests pass.

- [ ] **Step 7: Update the Firestore data model doc**

In `docs/firestore-data-model.md`, find the `milestones/{milestoneId}` table and update the `startDate` and `endDate` rows, and add `description`:

```markdown
| `description` | `string?` | Markdown. Optional on all milestones. |
| `startDate` | `string?` | Required for non-backlog milestones |
| `endDate` | `string?` | Required for non-backlog milestones |
```

Also update the Global Types section at the bottom:

```typescript
type MilestoneStatus = 'backlog' | 'not_started' | 'in_progress' | 'blocked' | 'completed'
```

- [ ] **Step 8: Commit**

```bash
git add lib/types.ts lib/firestore/milestones.ts lib/types.test.ts lib/firestore/milestones.test.ts docs/firestore-data-model.md
git commit -m "feat: add backlog status and description field to Milestone type and Firestore layer"
```

---

### Task 3: MarkdownBody component

**Files:**
- Create: `components/ui/markdown-body.tsx`
- Create: `components/ui/markdown-body.test.tsx`

**Interfaces:**
- Consumes: `react-markdown` (installed in Task 1)
- Produces: `MarkdownBody({ content: string }): JSX.Element` — renders markdown with prose styling

- [ ] **Step 1: Write failing test**

Create `components/ui/markdown-body.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="md">{children}</div>,
}))

test('renders content inside a prose wrapper', async () => {
  const { MarkdownBody } = await import('./markdown-body')
  render(<MarkdownBody content="## Hello\n\nWorld" />)
  expect(screen.getByTestId('md')).toHaveTextContent('## Hello')
})

test('applies prose classes to wrapper div', async () => {
  const { MarkdownBody } = await import('./markdown-body')
  const { container } = render(<MarkdownBody content="text" />)
  const wrapper = container.firstChild as HTMLElement
  expect(wrapper.className).toContain('prose')
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run components/ui/markdown-body.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `components/ui/markdown-body.tsx`:

```tsx
import ReactMarkdown from 'react-markdown'

interface Props {
  content: string
}

export function MarkdownBody({ content }: Props) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npx vitest run components/ui/markdown-body.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/markdown-body.tsx components/ui/markdown-body.test.tsx
git commit -m "feat: add MarkdownBody component with prose styling"
```

---

### Task 4: BacklogItemCard component

**Files:**
- Create: `components/milestones/backlog-item-card.tsx`
- Create: `components/milestones/backlog-item-card.test.tsx`

**Interfaces:**
- Consumes:
  - `MarkdownBody({ content: string })` from `@/components/ui/markdown-body`
  - `Milestone`, `MilestoneStatus` from `@/lib/types`
  - `Button` from `@/components/ui/button`
  - `Input` from `@/components/ui/input`
  - `Label` from `@/components/ui/label`
- Produces:
  ```ts
  BacklogItemCard({
    milestone: Milestone,         // must have status === 'backlog'
    canEdit: boolean,
    onStatusChange: (milestone: Milestone, newStatus: MilestoneStatus) => Promise<void>,
    onUpdate: (id: string, data: { name: string; startDate?: string; endDate?: string; description?: string }) => Promise<void>,
    onDelete: (id: string) => Promise<void>,
  }): JSX.Element
  ```

- [ ] **Step 1: Write failing tests**

Create `components/milestones/backlog-item-card.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import type { Milestone } from '@/lib/types'

vi.mock('@/components/ui/markdown-body', () => ({
  MarkdownBody: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...rest }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean; [k: string]: unknown }>) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}))

const base: Milestone = {
  id: 'm1',
  name: 'Research spike',
  status: 'backlog',
  description: '## Goals\n\nDefine scope.',
  history: [],
  createdAt: '2026-09-23T00:00:00Z',
  updatedAt: '2026-09-23T00:00:00Z',
  createdBy: 'uid1',
}

test('renders name and markdown description', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  render(
    <BacklogItemCard
      milestone={base}
      canEdit={false}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Research spike')).toBeInTheDocument()
  expect(screen.getByTestId('markdown')).toHaveTextContent('## Goals')
})

test('hides edit and delete buttons when canEdit is false', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  render(
    <BacklogItemCard
      milestone={base}
      canEdit={false}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  expect(screen.queryByText('Delete')).not.toBeInTheDocument()
})

test('blocks status change and shows error when no dates', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  const onStatusChange = vi.fn()
  render(
    <BacklogItemCard
      milestone={base}
      canEdit={true}
      onStatusChange={onStatusChange}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  const select = screen.getByRole('combobox')
  fireEvent.change(select, { target: { value: 'not_started' } })
  expect(onStatusChange).not.toHaveBeenCalled()
  expect(screen.getByText(/add start and end dates before scheduling/i)).toBeInTheDocument()
})

test('allows status change when dates are present', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  const onStatusChange = vi.fn().mockResolvedValue(undefined)
  const withDates: Milestone = { ...base, startDate: '2026-10-01', endDate: '2026-10-31' }
  render(
    <BacklogItemCard
      milestone={withDates}
      canEdit={true}
      onStatusChange={onStatusChange}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  const select = screen.getByRole('combobox')
  fireEvent.change(select, { target: { value: 'not_started' } })
  expect(onStatusChange).toHaveBeenCalledWith(withDates, 'not_started')
})

test('shows "No description" placeholder when description is absent', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  const noDesc: Milestone = { ...base, description: undefined }
  render(
    <BacklogItemCard
      milestone={noDesc}
      canEdit={false}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText(/no description/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run components/milestones/backlog-item-card.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `components/milestones/backlog-item-card.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MarkdownBody } from '@/components/ui/markdown-body'
import type { Milestone, MilestoneStatus } from '@/lib/types'

interface Props {
  milestone: Milestone
  canEdit: boolean
  onStatusChange: (milestone: Milestone, newStatus: MilestoneStatus) => Promise<void>
  onUpdate: (id: string, data: { name: string; startDate?: string; endDate?: string; description?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const SCHEDULED_STATUSES: MilestoneStatus[] = ['not_started', 'in_progress', 'blocked', 'completed']
const STATUS_LABELS: Record<MilestoneStatus, string> = {
  backlog: 'Backlog',
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

export function BacklogItemCard({ milestone, canEdit, onStatusChange, onUpdate, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(milestone.name)
  const [editDesc, setEditDesc] = useState(milestone.description ?? '')
  const [editStart, setEditStart] = useState(milestone.startDate ?? '')
  const [editEnd, setEditEnd] = useState(milestone.endDate ?? '')
  const [saving, setSaving] = useState(false)
  const [dateError, setDateError] = useState(false)

  const hasDates = !!milestone.startDate && !!milestone.endDate

  function openEdit() {
    setEditName(milestone.name)
    setEditDesc(milestone.description ?? '')
    setEditStart(milestone.startDate ?? '')
    setEditEnd(milestone.endDate ?? '')
    setEditing(true)
  }

  async function handleSave() {
    if (!editName.trim()) return
    setSaving(true)
    try {
      await onUpdate(milestone.id, {
        name: editName.trim(),
        description: editDesc.trim() || undefined,
        startDate: editStart || undefined,
        endDate: editEnd || undefined,
      })
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange(newStatus: MilestoneStatus) {
    if (newStatus !== 'backlog' && !hasDates) {
      setDateError(true)
      return
    }
    setDateError(false)
    await onStatusChange(milestone, newStatus)
  }

  if (editing) {
    return (
      <div className="rounded-lg border p-4 bg-muted/30 flex flex-col gap-3">
        <div>
          <Label className="text-xs mb-1">Name</Label>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs mb-1">Description (markdown)</Label>
          <textarea
            className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/50"
            value={editDesc}
            onChange={(e) => setEditDesc(e.target.value)}
            placeholder="Describe this backlog item…"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1">Start Date (optional)</Label>
            <Input type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1">End Date (optional)</Label>
            <Input type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-4 mb-2">
        <p className="font-medium">{milestone.name}</p>
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={milestone.status}
            disabled={!canEdit}
            onChange={(e) => handleStatusChange(e.target.value as MilestoneStatus)}
            className="text-sm border rounded px-2 py-1 bg-background outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50"
          >
            <option value="backlog">Backlog</option>
            {SCHEDULED_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {canEdit && (
            <>
              <Button size="sm" variant="ghost" onClick={openEdit}>Edit</Button>
              <Button size="sm" variant="destructive" onClick={() => onDelete(milestone.id)}>Delete</Button>
            </>
          )}
        </div>
      </div>
      {dateError && (
        <p className="text-xs text-destructive mb-2">Add start and end dates before scheduling.</p>
      )}
      {milestone.startDate && milestone.endDate && (
        <p className="text-xs text-muted-foreground mb-2">{milestone.startDate} – {milestone.endDate}</p>
      )}
      {milestone.description ? (
        <MarkdownBody content={milestone.description} />
      ) : (
        <p className="text-sm text-muted-foreground italic">No description.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run components/milestones/backlog-item-card.test.tsx
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/milestones/backlog-item-card.tsx components/milestones/backlog-item-card.test.tsx
git commit -m "feat: add BacklogItemCard component with markdown rendering and date gate"
```

---

### Task 5: Update MilestonesGantt

**Files:**
- Modify: `components/milestones/milestones-gantt.tsx`
- Create: `components/milestones/milestones-gantt.test.tsx`

**Interfaces:**
- Consumes: `Milestone` (now with optional `startDate`/`endDate`, `'backlog'` in status union)
- Produces: same `MilestonesGantt({ milestones, showTooltips? })` — unchanged external signature; now handles `'backlog'` in exhaustive type checks

- [ ] **Step 1: Write failing test**

Create `components/milestones/milestones-gantt.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import type { Milestone } from '@/lib/types'

const scheduled: Milestone = {
  id: 'm1',
  name: 'Ship v1',
  status: 'not_started',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  history: [],
  createdAt: '',
  updatedAt: '',
  createdBy: 'u1',
}

test('renders scheduled milestone name', async () => {
  const { MilestonesGantt } = await import('./milestones-gantt')
  render(<MilestonesGantt milestones={[scheduled]} />)
  expect(screen.getAllByText('Ship v1').length).toBeGreaterThan(0)
})

test('renders empty state when no milestones', async () => {
  const { MilestonesGantt } = await import('./milestones-gantt')
  render(<MilestonesGantt milestones={[]} />)
  expect(screen.getByText(/no milestones yet/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm current state**

```bash
npx vitest run components/milestones/milestones-gantt.test.tsx
```

These may fail due to TypeScript errors after the types change in Task 2.

- [ ] **Step 3: Update milestones-gantt.tsx**

The gantt needs two changes:
1. `STATUS_LABELS` and `barClasses` must handle `'backlog'` (TypeScript exhaustiveness — even though the page filters them out, the type union now includes 'backlog')
2. `startDate`/`endDate` are now `string | undefined` — use nullish coalescing when sorting/computing dates

Replace the full file:

```tsx
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
  backlog: 'Backlog',
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

function barClasses(status: MilestoneStatus): string {
  switch (status) {
    case 'backlog':
      return 'bg-muted border border-border text-muted-foreground'
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

  const withDates = milestones.filter(
    (m): m is Milestone & { startDate: string; endDate: string } =>
      !!m.startDate && !!m.endDate,
  )

  if (withDates.length === 0) {
    return <p className="text-sm text-muted-foreground p-4">No milestones yet.</p>
  }

  const sorted = [...withDates].sort((a, b) => a.startDate.localeCompare(b.startDate))

  const dates = sorted.flatMap((m) => [new Date(m.startDate), new Date(m.endDate)])
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())))
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())))

  const rangeStart = addDays(minDate, -7)
  const rangeEnd = addDays(maxDate, 7)
  const totalDays = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)

  const mondays = getMondaysInRange(rangeStart, rangeEnd)
  const weeks = mondays.length
  const minWidth = Math.max(700, weeks * 80 + 220)

  function formatShort(d: Date): string {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <div style={{ minWidth }}>
        {/* Header row */}
        <div className="flex border-b">
          <div className="flex-shrink-0 sticky left-0 z-10 bg-card border-r border-border/40" style={{ width: 220 }} />
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
                className="flex-shrink-0 sticky left-0 z-10 bg-card border-r border-border/40 px-3 py-1 text-sm font-medium text-foreground"
                style={{ width: 220 }}
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
                    <div className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2 bg-popover text-popover-foreground border rounded-lg shadow-lg px-3 py-2 text-xs whitespace-nowrap pointer-events-none">
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
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run components/milestones/milestones-gantt.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/milestones/milestones-gantt.tsx components/milestones/milestones-gantt.test.tsx
git commit -m "feat: update MilestonesGantt to handle optional dates and backlog status"
```

---

### Task 6: Update MilestonesManager and MilestonesPage

**Files:**
- Modify: `components/milestones/milestones-manager.tsx`
- Create: `components/milestones/milestones-manager.test.tsx`
- Modify: `app/(pm)/projects/[projectId]/milestones/page.tsx`

**Interfaces:**
- Consumes:
  - `BacklogItemCard` from `@/components/milestones/backlog-item-card`
  - Updated `Milestone`, `MilestoneStatus` from `@/lib/types`
  - Updated `addMilestone`, `updateMilestone` from `@/lib/firestore/milestones`
- Produces: complete milestones page with Gantt (scheduled only), scheduled milestone list, and backlog section

- [ ] **Step 1: Write failing tests for MilestonesManager**

Create `components/milestones/milestones-manager.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { Milestone } from '@/lib/types'

vi.mock('@/components/milestones/backlog-item-card', () => ({
  BacklogItemCard: ({ milestone }: { milestone: Milestone }) => (
    <div data-testid="backlog-card">{milestone.name}</div>
  ),
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
}))
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}))

const scheduled: Milestone = {
  id: 's1',
  name: 'Ship v1',
  status: 'not_started',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  history: [],
  createdAt: '',
  updatedAt: '',
  createdBy: 'u1',
}

const backlogItem: Milestone = {
  id: 'b1',
  name: 'Research idea',
  status: 'backlog',
  history: [],
  createdAt: '',
  updatedAt: '',
  createdBy: 'u1',
}

test('renders scheduled milestone in milestones section', async () => {
  const { MilestonesManager } = await import('./milestones-manager')
  render(
    <MilestonesManager
      milestones={[scheduled]}
      canEdit={false}
      onAddMilestone={vi.fn()}
      onAddBacklog={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Ship v1')).toBeInTheDocument()
  expect(screen.queryByTestId('backlog-card')).not.toBeInTheDocument()
})

test('renders backlog item as BacklogItemCard', async () => {
  const { MilestonesManager } = await import('./milestones-manager')
  render(
    <MilestonesManager
      milestones={[backlogItem]}
      canEdit={false}
      onAddMilestone={vi.fn()}
      onAddBacklog={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByTestId('backlog-card')).toHaveTextContent('Research idea')
})

test('renders both sections when both types present', async () => {
  const { MilestonesManager } = await import('./milestones-manager')
  render(
    <MilestonesManager
      milestones={[scheduled, backlogItem]}
      canEdit={false}
      onAddMilestone={vi.fn()}
      onAddBacklog={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Ship v1')).toBeInTheDocument()
  expect(screen.getByTestId('backlog-card')).toHaveTextContent('Research idea')
})

test('shows Add milestone and Add backlog item buttons for editors', async () => {
  const { MilestonesManager } = await import('./milestones-manager')
  render(
    <MilestonesManager
      milestones={[]}
      canEdit={true}
      onAddMilestone={vi.fn()}
      onAddBacklog={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Add milestone')).toBeInTheDocument()
  expect(screen.getByText('Add backlog item')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run components/milestones/milestones-manager.test.tsx
```

Expected: FAIL (prop type mismatch or missing split).

- [ ] **Step 3: Replace milestones-manager.tsx**

```tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BacklogItemCard } from '@/components/milestones/backlog-item-card'
import type { Milestone, MilestoneStatus } from '@/lib/types'

interface Props {
  milestones: Milestone[]
  canEdit: boolean
  onAddMilestone: (data: { name: string; startDate: string; endDate: string }) => Promise<void>
  onAddBacklog: (data: { name: string; description?: string }) => Promise<void>
  onStatusChange: (milestone: Milestone, newStatus: MilestoneStatus) => Promise<void>
  onUpdate: (id: string, data: { name: string; startDate?: string; endDate?: string; description?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  backlog: 'Backlog',
  not_started: 'Not Started',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  completed: 'Completed',
}

const STATUS_COLOR: Record<MilestoneStatus, string> = {
  backlog: 'text-muted-foreground',
  not_started: 'text-muted-foreground',
  in_progress: 'text-primary',
  blocked: 'text-destructive',
  completed: 'text-green-600',
}

const SCHEDULED_STATUSES: MilestoneStatus[] = ['backlog', 'not_started', 'in_progress', 'blocked', 'completed']

export function MilestonesManager({
  milestones,
  canEdit,
  onAddMilestone,
  onAddBacklog,
  onStatusChange,
  onUpdate,
  onDelete,
}: Props) {
  // ── Add milestone form state ──────────────────────────────────────────────
  const [addingMilestone, setAddingMilestone] = useState(false)
  const [addName, setAddName] = useState('')
  const [addStart, setAddStart] = useState('')
  const [addEnd, setAddEnd] = useState('')
  const [savingMilestone, setSavingMilestone] = useState(false)

  // ── Add backlog form state ────────────────────────────────────────────────
  const [addingBacklog, setAddingBacklog] = useState(false)
  const [addBacklogName, setAddBacklogName] = useState('')
  const [addBacklogDesc, setAddBacklogDesc] = useState('')
  const [savingBacklog, setSavingBacklog] = useState(false)

  // ── Edit scheduled milestone state ────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editStart, setEditStart] = useState('')
  const [editEnd, setEditEnd] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // ── Split milestones ──────────────────────────────────────────────────────
  const scheduled = [...milestones.filter((m) => m.status !== 'backlog')].sort(
    (a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''),
  )
  const backlog = [...milestones.filter((m) => m.status === 'backlog')].sort((a, b) =>
    a.name.localeCompare(b.name),
  )

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleAddMilestone() {
    if (!addName.trim() || !addStart || !addEnd) return
    setSavingMilestone(true)
    try {
      await onAddMilestone({ name: addName.trim(), startDate: addStart, endDate: addEnd })
      setAddingMilestone(false)
      setAddName('')
      setAddStart('')
      setAddEnd('')
    } finally {
      setSavingMilestone(false)
    }
  }

  async function handleAddBacklog() {
    if (!addBacklogName.trim()) return
    setSavingBacklog(true)
    try {
      await onAddBacklog({
        name: addBacklogName.trim(),
        description: addBacklogDesc.trim() || undefined,
      })
      setAddingBacklog(false)
      setAddBacklogName('')
      setAddBacklogDesc('')
    } finally {
      setSavingBacklog(false)
    }
  }

  function startEdit(m: Milestone) {
    setEditingId(m.id)
    setEditName(m.name)
    setEditStart(m.startDate ?? '')
    setEditEnd(m.endDate ?? '')
    setEditDesc(m.description ?? '')
  }

  async function handleUpdate(id: string) {
    if (!editName.trim() || !editStart || !editEnd) return
    setSavingEdit(true)
    try {
      await onUpdate(id, {
        name: editName.trim(),
        startDate: editStart,
        endDate: editEnd,
        description: editDesc.trim() || undefined,
      })
      setEditingId(null)
    } finally {
      setSavingEdit(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── Scheduled Milestones ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Milestones</h2>
          {canEdit && !addingMilestone && (
            <Button size="sm" onClick={() => setAddingMilestone(true)}>
              Add milestone
            </Button>
          )}
        </div>

        {addingMilestone && (
          <div className="mb-4 rounded-lg border p-4 bg-muted/30">
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <Label htmlFor="add-name" className="text-xs mb-1">Name</Label>
                <Input id="add-name" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Milestone name" />
              </div>
              <div>
                <Label htmlFor="add-start" className="text-xs mb-1">Start Date</Label>
                <Input id="add-start" type="date" value={addStart} onChange={(e) => setAddStart(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="add-end" className="text-xs mb-1">End Date</Label>
                <Input id="add-end" type="date" value={addEnd} onChange={(e) => setAddEnd(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddMilestone} disabled={savingMilestone}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingMilestone(false); setAddName(''); setAddStart(''); setAddEnd('') }}>Cancel</Button>
            </div>
          </div>
        )}

        {scheduled.length === 0 && !addingMilestone ? (
          <p className="text-sm text-muted-foreground">No scheduled milestones yet.</p>
        ) : (
          <div className="rounded-lg border divide-y">
            {scheduled.map((m) =>
              editingId === m.id ? (
                <div key={m.id} className="p-3 bg-muted/30 flex flex-col gap-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor={`edit-name-${m.id}`} className="text-xs mb-1">Name</Label>
                      <Input id={`edit-name-${m.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor={`edit-start-${m.id}`} className="text-xs mb-1">Start Date</Label>
                      <Input id={`edit-start-${m.id}`} type="date" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor={`edit-end-${m.id}`} className="text-xs mb-1">End Date</Label>
                      <Input id={`edit-end-${m.id}`} type="date" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor={`edit-desc-${m.id}`} className="text-xs mb-1">Notes (markdown, optional)</Label>
                    <textarea
                      id={`edit-desc-${m.id}`}
                      className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/50"
                      value={editDesc}
                      onChange={(e) => setEditDesc(e.target.value)}
                      placeholder="Optional notes…"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleUpdate(m.id)} disabled={savingEdit}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div key={m.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.startDate} – {m.endDate}
                    </p>
                  </div>
                  <select
                    value={m.status}
                    disabled={!canEdit}
                    onChange={(e) => onStatusChange(m, e.target.value as MilestoneStatus)}
                    className={`text-sm border rounded px-2 py-1 bg-background outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50 ${STATUS_COLOR[m.status]}`}
                  >
                    {SCHEDULED_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                  {canEdit && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(m)}>Edit</Button>
                      <Button size="sm" variant="destructive" onClick={() => onDelete(m.id)}>Delete</Button>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        )}
      </div>

      {/* ── Backlog ──────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Backlog</h2>
          {canEdit && !addingBacklog && (
            <Button size="sm" variant="outline" onClick={() => setAddingBacklog(true)}>
              Add backlog item
            </Button>
          )}
        </div>

        {addingBacklog && (
          <div className="mb-4 rounded-lg border p-4 bg-muted/30 flex flex-col gap-3">
            <div>
              <Label htmlFor="add-backlog-name" className="text-xs mb-1">Name</Label>
              <Input id="add-backlog-name" value={addBacklogName} onChange={(e) => setAddBacklogName(e.target.value)} placeholder="Backlog item name" />
            </div>
            <div>
              <Label htmlFor="add-backlog-desc" className="text-xs mb-1">Description (markdown, optional)</Label>
              <textarea
                id="add-backlog-desc"
                className="w-full min-h-[120px] rounded-md border bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring/50"
                value={addBacklogDesc}
                onChange={(e) => setAddBacklogDesc(e.target.value)}
                placeholder="Describe this backlog item…"
              />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAddBacklog} disabled={savingBacklog}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => { setAddingBacklog(false); setAddBacklogName(''); setAddBacklogDesc('') }}>Cancel</Button>
            </div>
          </div>
        )}

        {backlog.length === 0 && !addingBacklog ? (
          <p className="text-sm text-muted-foreground">No backlog items.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {backlog.map((m) => (
              <BacklogItemCard
                key={m.id}
                milestone={m}
                canEdit={canEdit}
                onStatusChange={onStatusChange}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run MilestonesManager tests**

```bash
npx vitest run components/milestones/milestones-manager.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Update the milestones page**

Replace `app/(pm)/projects/[projectId]/milestones/page.tsx`:

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listMilestones, addMilestone, updateMilestone, updateMilestoneStatus, deleteMilestone } from '@/lib/firestore/milestones'
import { MilestonesManager } from '@/components/milestones/milestones-manager'
import { MilestonesGantt } from '@/components/milestones/milestones-gantt'
import type { Milestone, MilestoneStatus } from '@/lib/types'

export default function MilestonesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const { data: milestones = [] } = useQuery({
    queryKey: ['milestones', orgId, projectId],
    queryFn: () => listMilestones(orgId!, projectId),
    enabled: !!orgId,
  })

  const canEdit = user && project ? project.members[user.uid] !== 'viewer' : false

  const inv = () => qc.invalidateQueries({ queryKey: ['milestones', orgId, projectId] })

  const scheduled = milestones.filter((m) => m.status !== 'backlog')

  async function handleAddMilestone(data: { name: string; startDate: string; endDate: string }) {
    await addMilestone(orgId!, projectId, { ...data, status: 'not_started', createdBy: user!.uid })
    await inv()
  }

  async function handleAddBacklog(data: { name: string; description?: string }) {
    await addMilestone(orgId!, projectId, { ...data, status: 'backlog', createdBy: user!.uid })
    await inv()
  }

  async function handleStatusChange(milestone: Milestone, newStatus: MilestoneStatus) {
    await updateMilestoneStatus(orgId!, projectId, milestone.id, milestone.status, newStatus)
    await inv()
  }

  async function handleUpdate(id: string, data: { name: string; startDate?: string; endDate?: string; description?: string }) {
    await updateMilestone(orgId!, projectId, id, data)
    await inv()
  }

  async function handleDelete(id: string) {
    await deleteMilestone(orgId!, projectId, id)
    await inv()
  }

  return (
    <div className="flex flex-col gap-8">
      {scheduled.length > 0 && (
        <div>
          <h2 className="font-semibold mb-4">Timeline</h2>
          <MilestonesGantt milestones={scheduled} />
        </div>
      )}

      <MilestonesManager
        milestones={milestones}
        canEdit={canEdit}
        onAddMilestone={handleAddMilestone}
        onAddBacklog={handleAddBacklog}
        onStatusChange={handleStatusChange}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </div>
  )
}
```

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run
```

Expected: all tests pass. Fix any TypeScript errors surfaced by the type changes propagating into other test files.

- [ ] **Step 7: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are errors in other files referencing `MilestoneStatus` or `Milestone`, add `'backlog'` to their local `STATUS_LABELS` / switch cases.

- [ ] **Step 8: Commit**

```bash
git add components/milestones/milestones-manager.tsx components/milestones/milestones-manager.test.tsx app/\(pm\)/projects/\[projectId\]/milestones/page.tsx
git commit -m "feat: split milestones page into scheduled and backlog sections"
```
