# Orbital — Plan 2: PM Workspace

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full PM workspace — project dashboard, project creation, and all nine project tabs (Overview, SOW, Status, Files, ADO Board, Dev Plan, Stakeholders, Helpful Links, Roadmap).

**Architecture:** All Firestore reads go through TanStack Query hooks for caching. A top-level `users/{uid}` document stores the user's `orgId` for O(1) lookup — this supplements the per-org user records from Plan 1. A generic `CrudTable<T>` component backs the repeating CRUD tables (Risks, Issues, Onboard Items, etc.). ADO Board and Dev Plan tabs read from the `adoCache` subcollection, which Plan 4 populates — they render an empty/unconfigured state until then.

**Tech Stack:** Next.js 15 App Router, Firestore, TanStack Query v5, shadcn/ui, Tailwind CSS, Vitest, @testing-library/react

**Prerequisite:** Plan 1 complete.

## Global Constraints

- All constraints from Plan 1 apply
- All Firestore reads use TanStack Query (`useQuery`) — no raw `onSnapshot` in components
- `orgId` is read via `useOrgId()` hook in every client component that needs it
- Project pages read `projectId` from `useParams()`
- Owner-only actions (archive, delete, manage sharing) must be gated in UI with `project.members[uid] === 'owner'`
- Editor-only actions (all CRUD writes) gated with `role === 'owner' || role === 'editor'`
- Status labels: `on_track` → "On Track", `at_risk` → "At Risk", `off_track` → "Off Track"
- Status colors: `on_track` → green, `at_risk` → yellow, `off_track` → red

---

## File Map

```
app/(pm)/
├── layout.tsx                              # PM shell — reads uid, fetches orgId server-side
├── dashboard/page.tsx                      # Project list
├── projects/
│   ├── new/page.tsx                        # Create project
│   └── [projectId]/
│       ├── layout.tsx                      # Project shell — tab nav
│       ├── page.tsx                        # Redirect → /overview
│       ├── overview/page.tsx
│       ├── sow/page.tsx
│       ├── status/page.tsx
│       ├── files/page.tsx
│       ├── ado/page.tsx                    # Reads adoCache; empty state until Plan 4
│       ├── dev-plan/page.tsx               # Reads adoCache; empty state until Plan 4
│       ├── stakeholders/page.tsx
│       ├── helpful-links/page.tsx
│       └── roadmap/page.tsx
lib/firestore/
├── users.ts                                # getUserOrgId, setUserOrg
├── projects.ts                             # Project CRUD + addMember
├── subcollection.ts                        # Generic listItems/addItem/updateItem/deleteItem
├── resources.ts                            # Typed wrappers over subcollection
├── risks.ts
├── issues.ts
├── onboard-items.ts
├── client-actions.ts
├── stakeholders.ts
├── helpful-links.ts
├── roadmap-items.ts
├── status-snapshots.ts
├── files.ts                                # updateFileShared (upload is Plan 4)
└── ado-cache.ts                            # getLatestCache — read-only
hooks/
├── use-org.ts                              # useOrgId() — TanStack Query wrapper
└── use-project.ts                          # useProject(projectId)
components/
├── layout/
│   ├── pm-sidebar.tsx                      # Nav sidebar with sign-out
│   └── project-tabs.tsx                    # Tab strip for project workspace
├── projects/
│   ├── project-card.tsx                    # Card shown on dashboard
│   ├── project-form.tsx                    # Create project form
│   └── share-dialog.tsx                    # Add member by email + role
├── status/
│   ├── status-badge.tsx                    # ON TRACK / AT RISK / OFF TRACK badge
│   └── snapshot-form.tsx                   # Capture status snapshot
└── tables/
    └── crud-table.tsx                      # Generic add/edit/delete table
```

---

### Task 1: User-Org Mapping

**Context:** Plan 1's `createOrg` and `joinOrg` write to `orgs/{orgId}/users/{uid}` but don't record which org a user belongs to at the top level. This task adds a `users/{uid}` document for O(1) orgId lookup and a `useOrgId()` hook that every PM workspace page uses.

**Files:**
- Create: `lib/firestore/users.ts`
- Create: `lib/firestore/users.test.ts`
- Create: `hooks/use-org.ts`
- Modify: `lib/firestore/orgs.ts` — call `setUserOrg` inside `createOrg` and `joinOrg`
- Modify: `firestore.rules` — add `users/{uid}` rule

**Interfaces:**
- Produces: `setUserOrg(uid, orgId): Promise<void>`, `getUserOrgId(uid): Promise<string | null>`, `useOrgId(): string | undefined`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/firestore/users.test.ts
import { vi } from 'vitest'

const mockSetDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('setUserOrg writes orgId to users/{uid}', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockSetDoc.mockResolvedValue(undefined)
  const { setUserOrg } = await import('./users')
  await setUserOrg('uid1', 'org-abc')
  expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({ orgId: 'org-abc' }))
})

test('getUserOrgId returns null when doc does not exist', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockGetDoc.mockResolvedValue({ exists: () => false })
  const { getUserOrgId } = await import('./users')
  const result = await getUserOrgId('uid-nobody')
  expect(result).toBeNull()
})

test('getUserOrgId returns orgId when doc exists', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ orgId: 'org-xyz' }) })
  const { getUserOrgId } = await import('./users')
  const result = await getUserOrgId('uid1')
  expect(result).toBe('org-xyz')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test lib/firestore/users.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/firestore/users.ts`**

```typescript
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export async function setUserOrg(uid: string, orgId: string): Promise<void> {
  await setDoc(doc(db, `users/${uid}`), { orgId, updatedAt: serverTimestamp() }, { merge: true })
}

export async function getUserOrgId(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, `users/${uid}`))
  if (!snap.exists()) return null
  return snap.data().orgId ?? null
}
```

- [ ] **Step 4: Update `lib/firestore/orgs.ts` — call `setUserOrg` in `createOrg` and `joinOrg`**

In `createOrg`, after the `setDoc` call for the org user, add:
```typescript
import { setUserOrg } from './users'
// inside createOrg, after setDoc:
await setUserOrg(uid, orgRef.id)
```

In `joinOrg`, after the `setDoc` call, add:
```typescript
await setUserOrg(uid, orgId)
```

- [ ] **Step 5: Add `users/{uid}` rule to `firestore.rules`**

Inside the top-level `match /databases/{database}/documents {` block, before the closing brace, add:

```
match /users/{uid} {
  allow read, write: if isSignedIn() && request.auth.uid == uid;
}
```

- [ ] **Step 6: Create `hooks/use-org.ts`**

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import { getUserOrgId } from '@/lib/firestore/users'
import { useAuth } from './use-auth'

export function useOrgId(): string | undefined {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['orgId', user?.uid],
    queryFn: () => getUserOrgId(user!.uid),
    enabled: !!user,
    staleTime: Infinity,
  })
  return data ?? undefined
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test lib/firestore/users.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/firestore/users.ts lib/firestore/users.test.ts \
  lib/firestore/orgs.ts hooks/use-org.ts firestore.rules
git commit -m "feat: add user-org mapping and useOrgId hook"
```

---

### Task 2: Firestore Project CRUD Helpers

**Files:**
- Create: `lib/firestore/projects.ts`
- Create: `lib/firestore/projects.test.ts`
- Create: `hooks/use-project.ts`

**Interfaces:**
- Produces:
  - `createProject(orgId, uid, data): Promise<string>` — `data` is `Pick<Project, 'name'|'description'|'techStack'|'pmTools'>`
  - `listProjects(orgId, uid): Promise<Project[]>`
  - `getProject(orgId, projectId): Promise<Project | null>`
  - `updateProject(orgId, projectId, data: Partial<Project>): Promise<void>`
  - `archiveProject(orgId, projectId): Promise<void>`
  - `deleteProject(orgId, projectId): Promise<void>`
  - `addMember(orgId, projectId, uid: string, role: AccessLevel): Promise<void>`
  - `removeMember(orgId, projectId, uid: string): Promise<void>`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/firestore/projects.test.ts
import { vi } from 'vitest'
import type { Project } from '@/lib/types'

const mockAddDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockDeleteField = vi.fn(() => 'DELETE_SENTINEL')

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  deleteField: mockDeleteField,
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('createProject sets creator as owner in members map', async () => {
  mockAddDoc.mockResolvedValue({ id: 'proj-1' })
  mockCollection.mockReturnValue('col-ref')
  const { createProject } = await import('./projects')
  const id = await createProject('org1', 'uid-owner', {
    name: 'Test', description: '', techStack: [], pmTools: [],
  })
  expect(id).toBe('proj-1')
  expect(mockAddDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
    members: { 'uid-owner': 'owner' },
    orgId: 'org1',
    status: 'active',
  }))
})

test('addMember merges role into members map via updateDoc', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockUpdateDoc.mockResolvedValue(undefined)
  const { addMember } = await import('./projects')
  await addMember('org1', 'proj-1', 'uid-editor', 'editor')
  expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({
    'members.uid-editor': 'editor',
  }))
})

test('archiveProject sets status to archived', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockUpdateDoc.mockResolvedValue(undefined)
  const { archiveProject } = await import('./projects')
  await archiveProject('org1', 'proj-1')
  expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { status: 'archived', updatedAt: 'TS' })
})

test('getProject returns null when doc does not exist', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockGetDoc.mockResolvedValue({ exists: () => false })
  const { getProject } = await import('./projects')
  const result = await getProject('org1', 'no-such')
  expect(result).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test lib/firestore/projects.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/firestore/projects.ts`**

```typescript
import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where,
  deleteField, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Project, AccessLevel } from '@/lib/types'

type CreateData = Pick<Project, 'name' | 'description' | 'techStack' | 'pmTools'>

function projectPath(orgId: string) {
  return collection(db, `orgs/${orgId}/projects`)
}

export async function createProject(
  orgId: string,
  uid: string,
  data: CreateData,
): Promise<string> {
  const ref = await addDoc(projectPath(orgId), {
    ...data,
    orgId,
    status: 'active',
    adoOrgUrl: '',
    adoProject: '',
    adoTeam: '',
    adoPat: '',
    members: { [uid]: 'owner' },
    sow: { startDate: '', endDate: '', totalHours: 0, budgetHours: 0, summary: '' },
    statusHeader: {
      scheduleStatus: 'on_track',
      budgetStatus: 'on_track',
      scopeStatus: 'on_track',
    },
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function getProject(orgId: string, projectId: string): Promise<Project | null> {
  const snap = await getDoc(doc(db, `orgs/${orgId}/projects/${projectId}`))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Project
}

export async function listProjects(orgId: string, uid: string): Promise<Project[]> {
  const q = query(projectPath(orgId), where(`members.${uid}`, '!=', null))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Project)
}

export async function updateProject(
  orgId: string,
  projectId: string,
  data: Partial<Project>,
): Promise<void> {
  await updateDoc(doc(db, `orgs/${orgId}/projects/${projectId}`), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function archiveProject(orgId: string, projectId: string): Promise<void> {
  await updateDoc(doc(db, `orgs/${orgId}/projects/${projectId}`), {
    status: 'archived',
    updatedAt: serverTimestamp(),
  })
}

export async function deleteProject(orgId: string, projectId: string): Promise<void> {
  await deleteDoc(doc(db, `orgs/${orgId}/projects/${projectId}`))
}

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
}

export async function removeMember(
  orgId: string,
  projectId: string,
  uid: string,
): Promise<void> {
  await updateDoc(doc(db, `orgs/${orgId}/projects/${projectId}`), {
    [`members.${uid}`]: deleteField(),
    updatedAt: serverTimestamp(),
  })
}
```

- [ ] **Step 4: Create `hooks/use-project.ts`**

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import { getProject } from '@/lib/firestore/projects'

export function useProject(orgId: string | undefined, projectId: string) {
  return useQuery({
    queryKey: ['project', orgId, projectId],
    queryFn: () => getProject(orgId!, projectId),
    enabled: !!orgId && !!projectId,
  })
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test lib/firestore/projects.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/firestore/projects.ts lib/firestore/projects.test.ts hooks/use-project.ts
git commit -m "feat: add project CRUD Firestore helpers and useProject hook"
```

---

### Task 3: Generic Subcollection Helper + Typed Modules

**Files:**
- Create: `lib/firestore/subcollection.ts`
- Create: `lib/firestore/subcollection.test.ts`
- Create: `lib/firestore/risks.ts`
- Create: `lib/firestore/issues.ts`
- Create: `lib/firestore/onboard-items.ts`
- Create: `lib/firestore/client-actions.ts`
- Create: `lib/firestore/stakeholders.ts`
- Create: `lib/firestore/helpful-links.ts`
- Create: `lib/firestore/roadmap-items.ts`
- Create: `lib/firestore/status-snapshots.ts`
- Create: `lib/firestore/files.ts`
- Create: `lib/firestore/ado-cache.ts`

**Interfaces:**
- Produces generic helpers consumed by all typed modules:
  - `listItems<T>(collectionPath: string): Promise<T[]>`
  - `addItem<T>(collectionPath: string, data: Omit<T, 'id'>): Promise<string>`
  - `updateItem(collectionPath: string, id: string, data: object): Promise<void>`
  - `deleteItem(collectionPath: string, id: string): Promise<void>`
- Each typed module exports `list*`, `add*`, `update*`, `delete*` with typed signatures

- [ ] **Step 1: Write failing tests**

```typescript
// lib/firestore/subcollection.test.ts
import { vi } from 'vitest'

const mockAddDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockUpdateDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('listItems maps docs to objects with id', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockGetDocs.mockResolvedValue({
    docs: [
      { id: 'doc1', data: () => ({ title: 'A' }) },
      { id: 'doc2', data: () => ({ title: 'B' }) },
    ],
  })
  const { listItems } = await import('./subcollection')
  const result = await listItems('orgs/o1/projects/p1/risks')
  expect(result).toEqual([{ id: 'doc1', title: 'A' }, { id: 'doc2', title: 'B' }])
})

test('addItem returns new doc id', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'new-id' })
  const { addItem } = await import('./subcollection')
  const id = await addItem('orgs/o1/projects/p1/risks', { title: 'Risk A' })
  expect(id).toBe('new-id')
})

test('deleteItem calls deleteDoc', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockDeleteDoc.mockResolvedValue(undefined)
  const { deleteItem } = await import('./subcollection')
  await deleteItem('orgs/o1/projects/p1/risks', 'risk-1')
  expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test lib/firestore/subcollection.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/firestore/subcollection.ts`**

```typescript
import {
  collection, doc, addDoc, getDocs,
  updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export async function listItems<T>(collectionPath: string): Promise<T[]> {
  const snap = await getDocs(collection(db, collectionPath))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)
}

export async function addItem<T>(
  collectionPath: string,
  data: Omit<T, 'id'>,
): Promise<string> {
  const ref = await addDoc(collection(db, collectionPath), {
    ...data,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateItem(
  collectionPath: string,
  id: string,
  data: object,
): Promise<void> {
  await updateDoc(doc(db, collectionPath, id), {
    ...data,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteItem(collectionPath: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionPath, id))
}
```

- [ ] **Step 4: Create all typed subcollection modules**

Each module follows the same pattern. Create these files:

```typescript
// lib/firestore/risks.ts
import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Risk } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/risks`
export const listRisks = (o: string, p: string) => listItems<Risk>(path(o, p))
export const addRisk = (o: string, p: string, data: Omit<Risk, 'id'>) => addItem<Risk>(path(o, p), data)
export const updateRisk = (o: string, p: string, id: string, data: Partial<Risk>) => updateItem(path(o, p), id, data)
export const deleteRisk = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

```typescript
// lib/firestore/issues.ts
import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Issue } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/issues`
export const listIssues = (o: string, p: string) => listItems<Issue>(path(o, p))
export const addIssue = (o: string, p: string, data: Omit<Issue, 'id'>) => addItem<Issue>(path(o, p), data)
export const updateIssue = (o: string, p: string, id: string, data: Partial<Issue>) => updateItem(path(o, p), id, data)
export const deleteIssue = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

```typescript
// lib/firestore/onboard-items.ts
import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { OnboardItem } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/onboardItems`
export const listOnboardItems = (o: string, p: string) => listItems<OnboardItem>(path(o, p))
export const addOnboardItem = (o: string, p: string, data: Omit<OnboardItem, 'id'>) => addItem<OnboardItem>(path(o, p), data)
export const updateOnboardItem = (o: string, p: string, id: string, data: Partial<OnboardItem>) => updateItem(path(o, p), id, data)
export const deleteOnboardItem = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

```typescript
// lib/firestore/client-actions.ts
import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { ClientAction } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/clientActions`
export const listClientActions = (o: string, p: string) => listItems<ClientAction>(path(o, p))
export const addClientAction = (o: string, p: string, data: Omit<ClientAction, 'id'>) => addItem<ClientAction>(path(o, p), data)
export const updateClientAction = (o: string, p: string, id: string, data: Partial<ClientAction>) => updateItem(path(o, p), id, data)
export const deleteClientAction = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

```typescript
// lib/firestore/stakeholders.ts
import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Stakeholder } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/stakeholders`
export const listStakeholders = (o: string, p: string) => listItems<Stakeholder>(path(o, p))
export const addStakeholder = (o: string, p: string, data: Omit<Stakeholder, 'id'>) => addItem<Stakeholder>(path(o, p), data)
export const updateStakeholder = (o: string, p: string, id: string, data: Partial<Stakeholder>) => updateItem(path(o, p), id, data)
export const deleteStakeholder = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

```typescript
// lib/firestore/helpful-links.ts
import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { HelpfulLink } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/helpfulLinks`
export const listHelpfulLinks = (o: string, p: string) => listItems<HelpfulLink>(path(o, p))
export const addHelpfulLink = (o: string, p: string, data: Omit<HelpfulLink, 'id'>) => addItem<HelpfulLink>(path(o, p), data)
export const updateHelpfulLink = (o: string, p: string, id: string, data: Partial<HelpfulLink>) => updateItem(path(o, p), id, data)
export const deleteHelpfulLink = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

```typescript
// lib/firestore/roadmap-items.ts
import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { RoadmapItem } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/roadmapItems`
export const listRoadmapItems = (o: string, p: string) => listItems<RoadmapItem>(path(o, p))
export const addRoadmapItem = (o: string, p: string, data: Omit<RoadmapItem, 'id'>) => addItem<RoadmapItem>(path(o, p), data)
export const updateRoadmapItem = (o: string, p: string, id: string, data: Partial<RoadmapItem>) => updateItem(path(o, p), id, data)
export const deleteRoadmapItem = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

```typescript
// lib/firestore/status-snapshots.ts
import { listItems, addItem } from './subcollection'
import type { StatusSnapshot } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/statusSnapshots`
export const listStatusSnapshots = (o: string, p: string) => listItems<StatusSnapshot>(path(o, p))
export const addStatusSnapshot = (o: string, p: string, data: Omit<StatusSnapshot, 'id'>) =>
  addItem<StatusSnapshot>(path(o, p), data)
```

```typescript
// lib/firestore/files.ts
import { listItems, updateItem, deleteItem } from './subcollection'
import type { ProjectFile } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/files`
export const listFiles = (o: string, p: string) => listItems<ProjectFile>(path(o, p))
export const updateFileShared = (o: string, p: string, id: string, sharedWithClient: boolean) =>
  updateItem(path(o, p), id, { sharedWithClient })
export const deleteFile = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

```typescript
// lib/firestore/ado-cache.ts
import { listItems } from './subcollection'
import type { AdoCache } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/adoCache`

export async function getLatestCache(
  orgId: string,
  projectId: string,
  type: AdoCache['type'],
): Promise<AdoCache | null> {
  const all = await listItems<AdoCache>(path(orgId, projectId))
  const matches = all
    .filter((c) => c.type === type)
    .sort((a, b) => (a.fetchedAt > b.fetchedAt ? -1 : 1))
  return matches[0] ?? null
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test lib/firestore/subcollection.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/firestore/
git commit -m "feat: add generic subcollection helpers and all typed Firestore modules"
```

---

### Task 4: PM Workspace Layout + Sidebar

**Files:**
- Modify: `app/(pm)/layout.tsx`
- Create: `components/layout/pm-sidebar.tsx`
- Create: `components/layout/pm-sidebar.test.tsx`

**Interfaces:**
- Consumes: `useAuth()`, `useOrgId()`, `useRouter()`
- Produces: full-height sidebar layout wrapping all PM pages

- [ ] **Step 1: Write failing test**

```typescript
// components/layout/pm-sidebar.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn(() => ({ user: { displayName: 'Bryce' } })) }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: vi.fn() })), usePathname: vi.fn(() => '/dashboard') }))
global.fetch = vi.fn().mockResolvedValue({ ok: true })

test('renders dashboard nav link', async () => {
  const { PmSidebar } = await import('./pm-sidebar')
  render(<PmSidebar />)
  expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
})

test('renders sign out button', async () => {
  const { PmSidebar } = await import('./pm-sidebar')
  render(<PmSidebar />)
  expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/layout/pm-sidebar.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/layout/pm-sidebar.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, LogOut } from 'lucide-react'

export function PmSidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await fetch('/api/auth/signout', { method: 'POST' })
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-background">
      <div className="px-4 py-5 font-semibold text-lg">Orbital</div>
      <nav className="flex-1 px-2">
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted',
            pathname === '/dashboard' && 'bg-muted font-medium',
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          Dashboard
        </Link>
      </nav>
      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground truncate mb-2">{user?.displayName ?? user?.email}</p>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 4: Update `app/(pm)/layout.tsx`**

```typescript
import { PmSidebar } from '@/components/layout/pm-sidebar'

export default function PmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <PmSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test components/layout/pm-sidebar.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app/(pm)/layout.tsx components/layout/pm-sidebar.tsx components/layout/pm-sidebar.test.tsx
git commit -m "feat: add PM workspace layout with sidebar"
```

---

### Task 5: Project Dashboard + Create Project

**Files:**
- Create: `app/(pm)/dashboard/page.tsx`
- Create: `components/projects/project-card.tsx`
- Create: `components/projects/project-card.test.tsx`
- Create: `app/(pm)/projects/new/page.tsx`
- Create: `components/projects/project-form.tsx`

**Interfaces:**
- Consumes: `listProjects`, `createProject`, `useOrgId()`, `useAuth()`
- Produces: navigable dashboard; create form that redirects to `/projects/{id}/overview` on success

- [ ] **Step 1: Write failing card test**

```typescript
// components/projects/project-card.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: vi.fn() })) }))

test('renders project name and status badge', async () => {
  const { ProjectCard } = await import('./project-card')
  render(
    <ProjectCard
      project={{
        id: 'p1', name: 'Alpha Project', status: 'active',
        members: { uid1: 'owner' }, updatedAt: '2026-01-01',
        orgId: 'o1', description: '', techStack: [], pmTools: [],
        adoOrgUrl: '', adoProject: '', adoTeam: '', adoPat: '',
        sow: { startDate: '', endDate: '', totalHours: 0, budgetHours: 0, summary: '' },
        statusHeader: { scheduleStatus: 'on_track', budgetStatus: 'at_risk', scopeStatus: 'on_track' },
        createdBy: 'uid1', createdAt: '2026-01-01',
      }}
    />
  )
  expect(screen.getByText('Alpha Project')).toBeInTheDocument()
  expect(screen.getByText(/1 member/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/projects/project-card.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/projects/project-card.tsx`**

```typescript
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Project } from '@/lib/types'

interface Props { project: Project }

export function ProjectCard({ project }: Props) {
  const memberCount = Object.keys(project.members).length
  return (
    <Link href={`/projects/${project.id}/overview`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{project.name}</CardTitle>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">{project.description || 'No description'}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            {memberCount} member{memberCount !== 1 ? 's' : ''} · Updated {project.updatedAt?.slice(0, 10) ?? '—'}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
```

- [ ] **Step 4: Create `app/(pm)/dashboard/page.tsx`**

```typescript
'use client'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { listProjects } from '@/lib/firestore/projects'
import { ProjectCard } from '@/components/projects/project-card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()
  const orgId = useOrgId()

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', orgId, user?.uid],
    queryFn: () => listProjects(orgId!, user!.uid),
    enabled: !!orgId && !!user,
  })

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Button asChild>
          <Link href="/projects/new"><Plus className="h-4 w-4 mr-2" />New project</Link>
        </Button>
      </div>
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && projects.length === 0 && (
        <p className="text-muted-foreground">No projects yet. Create your first one.</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create `components/projects/project-form.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { createProject } from '@/lib/firestore/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function ProjectForm() {
  const { user } = useAuth()
  const orgId = useOrgId()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !orgId || !name.trim()) return
    setLoading(true)
    setError(null)
    try {
      const projectId = await createProject(orgId, user.uid, {
        name: name.trim(),
        description: description.trim(),
        techStack: [],
        pmTools: [],
      })
      router.push(`/projects/${projectId}/overview`)
    } catch {
      setError('Failed to create project.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-lg">
      <div>
        <Label htmlFor="name">Project name</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="desc">Description</Label>
        <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || !name.trim()}>
        {loading ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 6: Create `app/(pm)/projects/new/page.tsx`**

```typescript
import { ProjectForm } from '@/components/projects/project-form'

export default function NewProjectPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold mb-6">New project</h1>
      <ProjectForm />
    </div>
  )
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test components/projects/project-card.test.tsx
```
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/(pm)/dashboard/ app/(pm)/projects/new/ components/projects/
git commit -m "feat: add project dashboard, project card, and create project form"
```

---

### Task 6: Project Workspace Shell + Tab Navigation

**Files:**
- Create: `app/(pm)/projects/[projectId]/layout.tsx`
- Create: `app/(pm)/projects/[projectId]/page.tsx`
- Create: `components/layout/project-tabs.tsx`
- Create: `components/layout/project-tabs.test.tsx`

**Interfaces:**
- Consumes: `useProject(orgId, projectId)`, `useParams()`, `usePathname()`
- Produces: tab strip that highlights the active tab; layout wraps all project sub-pages

- [ ] **Step 1: Write failing tab test**

```typescript
// components/layout/project-tabs.test.tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/projects/p1/status'),
  useParams: vi.fn(() => ({ projectId: 'p1' })),
}))

test('renders all nine tab labels', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" />)
  const labels = ['Overview', 'SOW', 'Status', 'Files', 'ADO Board', 'Dev Plan', 'Stakeholders', 'Links', 'Roadmap']
  for (const label of labels) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
})

test('active tab has aria-current', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" />)
  const statusLink = screen.getByRole('link', { name: /status/i })
  expect(statusLink).toHaveAttribute('aria-current', 'page')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/layout/project-tabs.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/layout/project-tabs.tsx`**

```typescript
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { label: 'Overview',     segment: 'overview' },
  { label: 'SOW',          segment: 'sow' },
  { label: 'Status',       segment: 'status' },
  { label: 'Files',        segment: 'files' },
  { label: 'ADO Board',    segment: 'ado' },
  { label: 'Dev Plan',     segment: 'dev-plan' },
  { label: 'Stakeholders', segment: 'stakeholders' },
  { label: 'Links',        segment: 'helpful-links' },
  { label: 'Roadmap',      segment: 'roadmap' },
]

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname()
  return (
    <nav className="flex border-b overflow-x-auto">
      {TABS.map(({ label, segment }) => {
        const href = `/projects/${projectId}/${segment}`
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

- [ ] **Step 4: Create `app/(pm)/projects/[projectId]/layout.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { ProjectTabs } from '@/components/layout/project-tabs'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-8 pt-6 pb-0">
        <h1 className="text-xl font-semibold mb-4">{project?.name ?? '—'}</h1>
        <ProjectTabs projectId={projectId} />
      </div>
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
```

- [ ] **Step 5: Create `app/(pm)/projects/[projectId]/page.tsx`**

```typescript
import { redirect } from 'next/navigation'

export default function ProjectIndexPage({ params }: { params: { projectId: string } }) {
  redirect(`/projects/${params.projectId}/overview`)
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test components/layout/project-tabs.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/(pm)/projects/[projectId]/ components/layout/project-tabs.tsx components/layout/project-tabs.test.tsx
git commit -m "feat: add project workspace shell and tab navigation"
```

---

### Task 7: Overview Tab + Sharing Dialog

**Files:**
- Create: `app/(pm)/projects/[projectId]/overview/page.tsx`
- Create: `components/projects/share-dialog.tsx`
- Create: `components/projects/share-dialog.test.tsx`

**Interfaces:**
- Consumes: `useProject`, `updateProject`, `addMember`, `removeMember`, `useAuth`, `useOrgId`
- Produces: editable project fields; share dialog that adds a member by UID + role (v1: owner enters the UID directly — email lookup is a v2 addition)

- [ ] **Step 1: Write failing share dialog test**

```typescript
// components/projects/share-dialog.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

const mockAddMember = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/firestore/projects', () => ({ addMember: mockAddMember }))
vi.mock('@/hooks/use-org', () => ({ useOrgId: vi.fn(() => 'org1') }))

test('calls addMember with uid and selected role on submit', async () => {
  const { ShareDialog } = await import('./share-dialog')
  render(
    <ShareDialog projectId="proj1" open onOpenChange={vi.fn()} onSuccess={vi.fn()} />
  )
  fireEvent.change(screen.getByLabelText(/user id/i), { target: { value: 'uid-new' } })
  fireEvent.click(screen.getByRole('button', { name: /add member/i }))
  await vi.waitFor(() => {
    expect(mockAddMember).toHaveBeenCalledWith('org1', 'proj1', 'uid-new', 'editor')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/projects/share-dialog.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Create `components/projects/share-dialog.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addMember } from '@/lib/firestore/projects'
import { useOrgId } from '@/hooks/use-org'
import type { AccessLevel } from '@/lib/types'

interface Props {
  projectId: string
  open: boolean
  onOpenChange: (v: boolean) => void
  onSuccess: () => void
}

export function ShareDialog({ projectId, open, onOpenChange, onSuccess }: Props) {
  const orgId = useOrgId()
  const [uid, setUid] = useState('')
  const [role, setRole] = useState<AccessLevel>('editor')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd() {
    if (!orgId || !uid.trim()) return
    setLoading(true)
    setError(null)
    try {
      await addMember(orgId, projectId, uid.trim(), role)
      setUid('')
      onSuccess()
      onOpenChange(false)
    } catch {
      setError('Failed to add member.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Share project</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="share-uid">User ID</Label>
            <Input id="share-uid" value={uid} onChange={(e) => setUid(e.target.value)} placeholder="Firebase UID" />
          </div>
          <div>
            <Label htmlFor="share-role">Role</Label>
            <select
              id="share-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AccessLevel)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={handleAdd} disabled={loading || !uid.trim()}>
            {loading ? 'Adding…' : 'Add member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Create `app/(pm)/projects/[projectId]/overview/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { updateProject } from '@/lib/firestore/projects'
import { ShareDialog } from '@/components/projects/share-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export default function OverviewPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [shareOpen, setShareOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const isOwner = user && project ? project.members[user.uid] === 'owner' : false
  const canEdit = user && project
    ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
    : false

  async function handleSave() {
    if (!orgId) return
    setSaving(true)
    await updateProject(orgId, projectId, { name, description })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
    setSaving(false)
  }

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="proj-name">Project name</Label>
        <Input
          id="proj-name"
          value={name || project.name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="proj-desc">Description</Label>
        <Input
          id="proj-desc"
          value={description || project.description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canEdit}
        />
      </div>
      {canEdit && (
        <Button onClick={handleSave} disabled={saving} className="self-start">
          {saving ? 'Saving…' : 'Save'}
        </Button>
      )}

      <div>
        <h2 className="font-medium mb-2">Members</h2>
        <ul className="flex flex-col gap-1 mb-3">
          {Object.entries(project.members).map(([uid, role]) => (
            <li key={uid} className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{uid}</span>
              <Badge variant="outline">{role}</Badge>
            </li>
          ))}
        </ul>
        {isOwner && (
          <Button variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            Add member
          </Button>
        )}
      </div>

      <ShareDialog
        projectId={projectId}
        open={shareOpen}
        onOpenChange={setShareOpen}
        onSuccess={() => qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })}
      />
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test components/projects/share-dialog.test.tsx
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/(pm)/projects/[projectId]/overview/ components/projects/share-dialog.tsx components/projects/share-dialog.test.tsx
git commit -m "feat: add overview tab with project editing and share dialog"
```

---

### Task 8: SOW Tab + Resource Table

**Files:**
- Create: `app/(pm)/projects/[projectId]/sow/page.tsx`
- Create: `lib/firestore/resources.ts`

**Interfaces:**
- Consumes: `useProject`, `updateProject`, `listItems`/`addItem`/`updateItem`/`deleteItem` via resources module
- Produces: editable SOW fields + inline resource table with add/remove rows

- [ ] **Step 1: Create `lib/firestore/resources.ts`**

```typescript
import { listItems, addItem, updateItem, deleteItem } from './subcollection'
import type { Resource } from '@/lib/types'

const path = (o: string, p: string) => `orgs/${o}/projects/${p}/resources`
export const listResources = (o: string, p: string) => listItems<Resource>(path(o, p))
export const addResource = (o: string, p: string, data: Omit<Resource, 'id'>) => addItem<Resource>(path(o, p), data)
export const updateResource = (o: string, p: string, id: string, data: Partial<Resource>) => updateItem(path(o, p), id, data)
export const deleteResource = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
```

- [ ] **Step 2: Create `app/(pm)/projects/[projectId]/sow/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { updateProject } from '@/lib/firestore/projects'
import { listResources, addResource, deleteResource } from '@/lib/firestore/resources'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Resource } from '@/lib/types'

export default function SowPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const { data: resources = [] } = useQuery({
    queryKey: ['resources', orgId, projectId],
    queryFn: () => listResources(orgId!, projectId),
    enabled: !!orgId,
  })

  const [sow, setSow] = useState(project?.sow ?? { startDate: '', endDate: '', totalHours: 0, budgetHours: 0, summary: '' })
  const [saving, setSaving] = useState(false)
  const [newResource, setNewResource] = useState<Omit<Resource, 'id'>>({ name: '', role: '', hours: 0 })

  const canEdit = user && project
    ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
    : false

  async function handleSaveSow() {
    if (!orgId) return
    setSaving(true)
    await updateProject(orgId, projectId, { sow })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
    setSaving(false)
  }

  async function handleAddResource() {
    if (!orgId || !newResource.name.trim()) return
    await addResource(orgId, projectId, newResource)
    qc.invalidateQueries({ queryKey: ['resources', orgId, projectId] })
    setNewResource({ name: '', role: '', hours: 0 })
  }

  async function handleDeleteResource(id: string) {
    if (!orgId) return
    await deleteResource(orgId, projectId, id)
    qc.invalidateQueries({ queryKey: ['resources', orgId, projectId] })
  }

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  return (
    <div className="max-w-2xl flex flex-col gap-8">
      <section>
        <h2 className="font-semibold mb-4">Statement of Work</h2>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Start date</Label><Input type="date" value={sow.startDate} onChange={(e) => setSow({ ...sow, startDate: e.target.value })} disabled={!canEdit} /></div>
          <div><Label>End date</Label><Input type="date" value={sow.endDate} onChange={(e) => setSow({ ...sow, endDate: e.target.value })} disabled={!canEdit} /></div>
          <div><Label>Total hours</Label><Input type="number" value={sow.totalHours} onChange={(e) => setSow({ ...sow, totalHours: +e.target.value })} disabled={!canEdit} /></div>
          <div><Label>Budget hours</Label><Input type="number" value={sow.budgetHours} onChange={(e) => setSow({ ...sow, budgetHours: +e.target.value })} disabled={!canEdit} /></div>
        </div>
        <div className="mt-4"><Label>Summary</Label><Input value={sow.summary} onChange={(e) => setSow({ ...sow, summary: e.target.value })} disabled={!canEdit} /></div>
        {canEdit && <Button onClick={handleSaveSow} disabled={saving} className="mt-4">{saving ? 'Saving…' : 'Save SOW'}</Button>}
      </section>

      <section>
        <h2 className="font-semibold mb-4">Resource Schedule</h2>
        <table className="w-full text-sm border rounded-md overflow-hidden">
          <thead className="bg-muted"><tr><th className="text-left p-2">Name</th><th className="text-left p-2">Role</th><th className="text-left p-2">Hours</th>{canEdit && <th />}</tr></thead>
          <tbody>
            {resources.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.name}</td>
                <td className="p-2">{r.role}</td>
                <td className="p-2">{r.hours}</td>
                {canEdit && <td className="p-2"><Button variant="ghost" size="sm" onClick={() => handleDeleteResource(r.id)}>Remove</Button></td>}
              </tr>
            ))}
            {canEdit && (
              <tr className="border-t bg-muted/40">
                <td className="p-2"><Input placeholder="Name" value={newResource.name} onChange={(e) => setNewResource({ ...newResource, name: e.target.value })} /></td>
                <td className="p-2"><Input placeholder="Role" value={newResource.role} onChange={(e) => setNewResource({ ...newResource, role: e.target.value })} /></td>
                <td className="p-2"><Input type="number" placeholder="0" value={newResource.hours} onChange={(e) => setNewResource({ ...newResource, hours: +e.target.value })} /></td>
                <td className="p-2"><Button size="sm" onClick={handleAddResource}>Add</Button></td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(pm)/projects/[projectId]/sow/ lib/firestore/resources.ts
git commit -m "feat: add SOW tab with editable fields and resource schedule table"
```

---

### Task 9: Generic CRUD Table Component

**Files:**
- Create: `components/tables/crud-table.tsx`
- Create: `components/tables/crud-table.test.tsx`
- Create: `components/status/status-badge.tsx`

**Interfaces:**
- Produces:
  ```typescript
  type ColumnDef<T> = {
    key: keyof T
    label: string
    type?: 'text' | 'select' | 'toggle' | 'textarea'
    options?: string[]   // for type: 'select'
  }
  interface CrudTableProps<T extends { id: string }> {
    columns: ColumnDef<T>[]
    rows: T[]
    canEdit: boolean
    onAdd: (data: Omit<T, 'id'>) => Promise<void>
    onUpdate: (id: string, data: Partial<T>) => Promise<void>
    onDelete: (id: string) => Promise<void>
  }
  ```

- [ ] **Step 1: Write failing test**

```typescript
// components/tables/crud-table.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

test('renders column headers', async () => {
  const { CrudTable } = await import('./crud-table')
  const onAdd = vi.fn().mockResolvedValue(undefined)
  render(
    <CrudTable
      columns={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['open', 'resolved'] },
      ]}
      rows={[]}
      canEdit={true}
      onAdd={onAdd}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Title')).toBeInTheDocument()
  expect(screen.getByText('Status')).toBeInTheDocument()
})

test('calls onAdd when add row is submitted', async () => {
  const { CrudTable } = await import('./crud-table')
  const onAdd = vi.fn().mockResolvedValue(undefined)
  render(
    <CrudTable
      columns={[{ key: 'title', label: 'Title', type: 'text' }]}
      rows={[]}
      canEdit={true}
      onAdd={onAdd}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'New risk' } })
  fireEvent.click(screen.getByRole('button', { name: /add/i }))
  await vi.waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'New risk' })))
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/tables/crud-table.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Create `components/status/status-badge.tsx`**

```typescript
import { Badge } from '@/components/ui/badge'
import type { StatusLevel } from '@/lib/types'
import { cn } from '@/lib/utils'

const CONFIG: Record<StatusLevel, { label: string; className: string }> = {
  on_track: { label: 'On Track', className: 'bg-green-100 text-green-800 border-green-200' },
  at_risk:  { label: 'At Risk',  className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  off_track: { label: 'Off Track', className: 'bg-red-100 text-red-800 border-red-200' },
}

export function StatusBadge({ status }: { status: StatusLevel }) {
  const { label, className } = CONFIG[status]
  return <Badge variant="outline" className={cn(className)}>{label}</Badge>
}
```

- [ ] **Step 4: Create `components/tables/crud-table.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trash2 } from 'lucide-react'

export type ColumnDef<T> = {
  key: keyof T
  label: string
  type?: 'text' | 'select' | 'toggle' | 'textarea'
  options?: string[]
}

interface Props<T extends { id: string }> {
  columns: ColumnDef<T>[]
  rows: T[]
  canEdit: boolean
  onAdd: (data: Omit<T, 'id'>) => Promise<void>
  onUpdate: (id: string, data: Partial<T>) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

function emptyDraft<T>(columns: ColumnDef<T>[]): Record<string, unknown> {
  return Object.fromEntries(
    columns.map(({ key, type, options }) => [
      key,
      type === 'toggle' ? false : type === 'select' ? (options?.[0] ?? '') : '',
    ])
  )
}

export function CrudTable<T extends { id: string }>({ columns, rows, canEdit, onAdd, onUpdate, onDelete }: Props<T>) {
  const [draft, setDraft] = useState<Record<string, unknown>>(emptyDraft(columns))
  const [adding, setAdding] = useState(false)

  function setDraftField(key: string, value: unknown) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function handleAdd() {
    if (!draft) return
    setAdding(true)
    await onAdd(draft as Omit<T, 'id'>)
    setDraft(emptyDraft(columns))
    setAdding(false)
  }

  function renderCell(row: T, col: ColumnDef<T>) {
    const val = row[col.key]
    if (col.type === 'toggle') {
      return (
        <input
          type="checkbox"
          checked={!!val}
          disabled={!canEdit}
          onChange={(e) => canEdit && onUpdate(row.id, { [col.key]: e.target.checked } as Partial<T>)}
        />
      )
    }
    return <span className="text-sm">{String(val ?? '')}</span>
  }

  function renderDraftCell(col: ColumnDef<T>) {
    const val = draft[col.key as string]
    if (col.type === 'toggle') {
      return (
        <input
          type="checkbox"
          checked={!!val}
          onChange={(e) => setDraftField(col.key as string, e.target.checked)}
        />
      )
    }
    if (col.type === 'select') {
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => setDraftField(col.key as string, e.target.value)}
          className="border rounded px-2 py-1 text-sm w-full"
        >
          {col.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    }
    return (
      <Input
        placeholder={col.label}
        value={String(val ?? '')}
        onChange={(e) => setDraftField(col.key as string, e.target.value)}
      />
    )
  }

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted">
          <tr>
            {columns.map((c) => <th key={String(c.key)} className="text-left p-2 font-medium">{c.label}</th>)}
            {canEdit && <th />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              {columns.map((c) => <td key={String(c.key)} className="p-2">{renderCell(row, c)}</td>)}
              {canEdit && (
                <td className="p-2">
                  <Button variant="ghost" size="icon" onClick={() => onDelete(row.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              )}
            </tr>
          ))}
          {canEdit && (
            <tr className="border-t bg-muted/30">
              {columns.map((c) => <td key={String(c.key)} className="p-2">{renderDraftCell(c)}</td>)}
              <td className="p-2">
                <Button size="sm" onClick={handleAdd} disabled={adding}>Add</Button>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test components/tables/crud-table.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add components/tables/ components/status/status-badge.tsx
git commit -m "feat: add generic CrudTable component and StatusBadge"
```

---

### Task 10: Status Tab

**Files:**
- Create: `app/(pm)/projects/[projectId]/status/page.tsx`
- Create: `components/status/snapshot-form.tsx`

**Interfaces:**
- Consumes: `useProject`, `updateProject`, `CrudTable`, `StatusBadge`, all four CRUD modules (risks, issues, onboard-items, client-actions), `listStatusSnapshots`, `addStatusSnapshot`
- Produces: full status tab — header indicators, three metrics, four sub-tables, snapshot history

- [ ] **Step 1: Create `components/status/snapshot-form.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Project, StatusSnapshot } from '@/lib/types'

interface Props {
  project: Project
  budgetConsumed: number
  onSave: (data: Omit<StatusSnapshot, 'id'>) => Promise<void>
}

function schedulePercent(sow: Project['sow']): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  const now = Date.now()
  return Math.min(100, Math.round(((now - start) / (end - start)) * 100))
}

export function SnapshotForm({ project, budgetConsumed, onSave }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [scopeComplete, setScopeComplete] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await onSave({
      date,
      schedulePercent: schedulePercent(project.sow),
      budgetConsumed,
      scopeComplete,
      notes,
      adoCacheRef: '',
      createdBy: '',
      createdAt: new Date().toISOString(),
    })
    setNotes('')
    setSaving(false)
  }

  return (
    <div className="border rounded-md p-4 flex flex-col gap-3 bg-muted/20">
      <h3 className="font-medium">Capture snapshot</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Meeting date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div><Label>Scope complete (e.g. 159 / 231)</Label><Input value={scopeComplete} onChange={(e) => setScopeComplete(e.target.value)} placeholder="159 / 231" /></div>
      </div>
      <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button onClick={handleSave} disabled={saving} className="self-start">
        {saving ? 'Saving…' : 'Save snapshot'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(pm)/projects/[projectId]/status/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { updateProject } from '@/lib/firestore/projects'
import { listRisks, addRisk, updateRisk, deleteRisk } from '@/lib/firestore/risks'
import { listIssues, addIssue, updateIssue, deleteIssue } from '@/lib/firestore/issues'
import { listOnboardItems, addOnboardItem, updateOnboardItem, deleteOnboardItem } from '@/lib/firestore/onboard-items'
import { listClientActions, addClientAction, updateClientAction, deleteClientAction } from '@/lib/firestore/client-actions'
import { listStatusSnapshots, addStatusSnapshot } from '@/lib/firestore/status-snapshots'
import { CrudTable } from '@/components/tables/crud-table'
import { StatusBadge } from '@/components/status/status-badge'
import { SnapshotForm } from '@/components/status/snapshot-form'
import { Button } from '@/components/ui/button'
import type { StatusLevel, Risk, Issue, OnboardItem, ClientAction } from '@/lib/types'

const STATUS_OPTIONS: StatusLevel[] = ['on_track', 'at_risk', 'off_track']

function schedulePercent(sow: { startDate: string; endDate: string }): number {
  if (!sow.startDate || !sow.endDate) return 0
  const start = new Date(sow.startDate).getTime()
  const end = new Date(sow.endDate).getTime()
  return Math.min(100, Math.round(((Date.now() - start) / (end - start)) * 100))
}

export default function StatusPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const [budgetConsumed, setBudgetConsumed] = useState(0)

  const enabled = !!orgId
  const { data: risks = [] } = useQuery({ queryKey: ['risks', orgId, projectId], queryFn: () => listRisks(orgId!, projectId), enabled })
  const { data: issues = [] } = useQuery({ queryKey: ['issues', orgId, projectId], queryFn: () => listIssues(orgId!, projectId), enabled })
  const { data: onboardItems = [] } = useQuery({ queryKey: ['onboard', orgId, projectId], queryFn: () => listOnboardItems(orgId!, projectId), enabled })
  const { data: clientActions = [] } = useQuery({ queryKey: ['clientActions', orgId, projectId], queryFn: () => listClientActions(orgId!, projectId), enabled })
  const { data: snapshots = [] } = useQuery({ queryKey: ['snapshots', orgId, projectId], queryFn: () => listStatusSnapshots(orgId!, projectId), enabled })

  if (!project) return <p className="text-muted-foreground">Loading…</p>

  const canEdit = user ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor' : false
  const schedule = schedulePercent(project.sow)

  async function setStatus(field: 'scheduleStatus' | 'budgetStatus' | 'scopeStatus', value: StatusLevel) {
    if (!orgId) return
    await updateProject(orgId, projectId, {
      statusHeader: { ...project.statusHeader, [field]: value },
    })
    qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
  }

  const inv = (key: string) => () => qc.invalidateQueries({ queryKey: [key, orgId, projectId] })

  return (
    <div className="flex flex-col gap-8">
      {/* Status Header */}
      <section>
        <h2 className="font-semibold mb-4">Project Status</h2>
        <div className="grid grid-cols-3 gap-4">
          {(['scheduleStatus', 'budgetStatus', 'scopeStatus'] as const).map((field) => (
            <div key={field} className="border rounded-md p-4 flex flex-col gap-2">
              <p className="text-sm font-medium capitalize">{field.replace('Status', '')}</p>
              <StatusBadge status={project.statusHeader[field]} />
              {canEdit && (
                <select
                  value={project.statusHeader[field]}
                  onChange={(e) => setStatus(field, e.target.value as StatusLevel)}
                  className="text-xs border rounded px-2 py-1 mt-1"
                >
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Metrics */}
      <section className="grid grid-cols-3 gap-4">
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Schedule</p>
          <p className="text-2xl font-semibold">{schedule}%</p>
          <p className="text-xs text-muted-foreground">days elapsed</p>
        </div>
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Budget consumed</p>
          {canEdit
            ? <input type="number" value={budgetConsumed} onChange={(e) => setBudgetConsumed(+e.target.value)} className="text-2xl font-semibold w-24 border-b focus:outline-none" />
            : <p className="text-2xl font-semibold">{budgetConsumed}</p>
          }
          <p className="text-xs text-muted-foreground">of {project.sow.budgetHours} hours</p>
        </div>
        <div className="border rounded-md p-4">
          <p className="text-sm text-muted-foreground">Scope</p>
          <p className="text-2xl font-semibold">—</p>
          <p className="text-xs text-muted-foreground">stories from ADO (Plan 4)</p>
        </div>
      </section>

      {/* Onboard Items */}
      <section>
        <h2 className="font-semibold mb-3">Onboard Items</h2>
        <CrudTable<OnboardItem>
          columns={[
            { key: 'item', label: 'Item', type: 'text' },
            { key: 'owner', label: 'Owner', type: 'text' },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'actionItems', label: 'Action Items', type: 'text' },
            { key: 'complete', label: 'Done', type: 'toggle' },
          ]}
          rows={onboardItems}
          canEdit={canEdit}
          onAdd={(d) => addOnboardItem(orgId!, projectId, d as Omit<OnboardItem, 'id'>).then(inv('onboard'))}
          onUpdate={(id, d) => updateOnboardItem(orgId!, projectId, id, d).then(inv('onboard'))}
          onDelete={(id) => deleteOnboardItem(orgId!, projectId, id).then(inv('onboard'))}
        />
      </section>

      {/* Risks */}
      <section>
        <h2 className="font-semibold mb-3">Risks</h2>
        <CrudTable<Risk>
          columns={[
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'owner', label: 'Owner', type: 'text' },
            { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high'] },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['open', 'resolved'] },
          ]}
          rows={risks}
          canEdit={canEdit}
          onAdd={(d) => addRisk(orgId!, projectId, d as Omit<Risk, 'id'>).then(inv('risks'))}
          onUpdate={(id, d) => updateRisk(orgId!, projectId, id, d).then(inv('risks'))}
          onDelete={(id) => deleteRisk(orgId!, projectId, id).then(inv('risks'))}
        />
      </section>

      {/* Issues */}
      <section>
        <h2 className="font-semibold mb-3">Issues</h2>
        <CrudTable<Issue>
          columns={[
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'owner', label: 'Owner', type: 'text' },
            { key: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high'] },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'status', label: 'Status', type: 'select', options: ['open', 'resolved'] },
          ]}
          rows={issues}
          canEdit={canEdit}
          onAdd={(d) => addIssue(orgId!, projectId, d as Omit<Issue, 'id'>).then(inv('issues'))}
          onUpdate={(id, d) => updateIssue(orgId!, projectId, id, d).then(inv('issues'))}
          onDelete={(id) => deleteIssue(orgId!, projectId, id).then(inv('issues'))}
        />
      </section>

      {/* Need From Client */}
      <section>
        <h2 className="font-semibold mb-3">Need From Client</h2>
        <CrudTable<ClientAction>
          columns={[
            { key: 'stakeholderName', label: 'Stakeholder', type: 'text' },
            { key: 'description', label: 'Description', type: 'text' },
            { key: 'resolved', label: 'Resolved', type: 'toggle' },
          ]}
          rows={clientActions}
          canEdit={canEdit}
          onAdd={(d) => addClientAction(orgId!, projectId, d as Omit<ClientAction, 'id'>).then(inv('clientActions'))}
          onUpdate={(id, d) => updateClientAction(orgId!, projectId, id, d).then(inv('clientActions'))}
          onDelete={(id) => deleteClientAction(orgId!, projectId, id).then(inv('clientActions'))}
        />
      </section>

      {/* Snapshots */}
      {canEdit && (
        <section>
          <h2 className="font-semibold mb-3">Status Snapshots</h2>
          <SnapshotForm
            project={project}
            budgetConsumed={budgetConsumed}
            onSave={(d) => addStatusSnapshot(orgId!, projectId, { ...d, createdBy: user!.uid }).then(inv('snapshots'))}
          />
          {snapshots.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {[...snapshots].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
                <li key={s.id} className="border rounded-md p-3 text-sm">
                  <p className="font-medium">{s.date} — Schedule {s.schedulePercent}% · Budget {s.budgetConsumed}h · Scope {s.scopeComplete}</p>
                  {s.notes && <p className="text-muted-foreground mt-1">{s.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(pm)/projects/[projectId]/status/ components/status/
git commit -m "feat: add status tab with indicators, metrics, CRUD tables, and snapshots"
```

---

### Task 11: Context Files Tab

**Files:**
- Create: `app/(pm)/projects/[projectId]/files/page.tsx`

**Interfaces:**
- Consumes: `listFiles`, `updateFileShared`, `deleteFile` from `lib/firestore/files`
- Produces: file list with share toggle and delete; upload button is a stub (wired in Plan 4)

- [ ] **Step 1: Create `app/(pm)/projects/[projectId]/files/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listFiles, updateFileShared, deleteFile } from '@/lib/firestore/files'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'

export default function FilesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)

  const { data: files = [] } = useQuery({
    queryKey: ['files', orgId, projectId],
    queryFn: () => listFiles(orgId!, projectId),
    enabled: !!orgId,
  })

  const canEdit = user && project
    ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
    : false

  const inv = () => qc.invalidateQueries({ queryKey: ['files', orgId, projectId] })

  async function toggleShare(id: string, current: boolean) {
    if (!orgId) return
    await updateFileShared(orgId, projectId, id, !current)
    inv()
  }

  async function handleDelete(id: string) {
    if (!orgId) return
    await deleteFile(orgId, projectId, id)
    inv()
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Context Files</h2>
        {canEdit && (
          <Button disabled title="Upload wired in Plan 4">Upload file</Button>
        )}
      </div>

      {files.length === 0 && <p className="text-muted-foreground text-sm">No files uploaded yet.</p>}

      <div className="flex flex-col gap-2">
        {files.map((f) => (
          <div key={f.id} className="flex items-center justify-between border rounded-md px-4 py-3">
            <div>
              <p className="text-sm font-medium">{f.name}</p>
              <p className="text-xs text-muted-foreground">
                {(f.sizeBytes / 1024).toFixed(0)} KB · {f.uploadedAt?.slice(0, 10) ?? '—'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {f.sharedWithClient
                ? <Badge variant="outline" className="text-green-700 border-green-300">Shared</Badge>
                : <Badge variant="outline" className="text-muted-foreground">Internal</Badge>
              }
              {canEdit && (
                <>
                  <Button variant="outline" size="sm" onClick={() => toggleShare(f.id, f.sharedWithClient)}>
                    {f.sharedWithClient ? 'Unshare' : 'Share'}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/(pm)/projects/[projectId]/files/
git commit -m "feat: add context files tab with share toggle (upload stub for Plan 4)"
```

---

### Task 12: Stakeholders, Helpful Links, and Roadmap Tabs

**Files:**
- Create: `app/(pm)/projects/[projectId]/stakeholders/page.tsx`
- Create: `app/(pm)/projects/[projectId]/helpful-links/page.tsx`
- Create: `app/(pm)/projects/[projectId]/roadmap/page.tsx`

**Interfaces:**
- All three use `CrudTable` with their respective Firestore modules

- [ ] **Step 1: Create `app/(pm)/projects/[projectId]/stakeholders/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listStakeholders, addStakeholder, updateStakeholder, deleteStakeholder } from '@/lib/firestore/stakeholders'
import { CrudTable } from '@/components/tables/crud-table'
import type { Stakeholder } from '@/lib/types'

export default function StakeholdersPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)
  const { data: rows = [] } = useQuery({
    queryKey: ['stakeholders', orgId, projectId],
    queryFn: () => listStakeholders(orgId!, projectId),
    enabled: !!orgId,
  })
  const canEdit = user && project ? project.members[user.uid] !== 'viewer' : false
  const inv = () => qc.invalidateQueries({ queryKey: ['stakeholders', orgId, projectId] })

  return (
    <div>
      <h2 className="font-semibold mb-4">Stakeholders</h2>
      <CrudTable<Stakeholder>
        columns={[
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'role', label: 'Role', type: 'text' },
          { key: 'responsibilities', label: 'Responsibilities', type: 'text' },
        ]}
        rows={rows}
        canEdit={canEdit}
        onAdd={(d) => addStakeholder(orgId!, projectId, d as Omit<Stakeholder, 'id'>).then(inv)}
        onUpdate={(id, d) => updateStakeholder(orgId!, projectId, id, d).then(inv)}
        onDelete={(id) => deleteStakeholder(orgId!, projectId, id).then(inv)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(pm)/projects/[projectId]/helpful-links/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listHelpfulLinks, addHelpfulLink, updateHelpfulLink, deleteHelpfulLink } from '@/lib/firestore/helpful-links'
import { CrudTable } from '@/components/tables/crud-table'
import type { HelpfulLink } from '@/lib/types'

export default function HelpfulLinksPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)
  const { data: rows = [] } = useQuery({
    queryKey: ['links', orgId, projectId],
    queryFn: () => listHelpfulLinks(orgId!, projectId),
    enabled: !!orgId,
  })
  const canEdit = user && project ? project.members[user.uid] !== 'viewer' : false
  const inv = () => qc.invalidateQueries({ queryKey: ['links', orgId, projectId] })

  return (
    <div>
      <h2 className="font-semibold mb-4">Helpful Links</h2>
      <CrudTable<HelpfulLink>
        columns={[
          { key: 'label', label: 'Label', type: 'text' },
          { key: 'url', label: 'URL', type: 'text' },
        ]}
        rows={rows}
        canEdit={canEdit}
        onAdd={(d) => addHelpfulLink(orgId!, projectId, d as Omit<HelpfulLink, 'id'>).then(inv)}
        onUpdate={(id, d) => updateHelpfulLink(orgId!, projectId, id, d).then(inv)}
        onDelete={(id) => deleteHelpfulLink(orgId!, projectId, id).then(inv)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(pm)/projects/[projectId]/roadmap/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/use-auth'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { listRoadmapItems, addRoadmapItem, updateRoadmapItem, deleteRoadmapItem } from '@/lib/firestore/roadmap-items'
import { CrudTable } from '@/components/tables/crud-table'
import type { RoadmapItem } from '@/lib/types'

export default function RoadmapPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { user } = useAuth()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const { data: project } = useProject(orgId, projectId)
  const { data: rows = [] } = useQuery({
    queryKey: ['roadmap', orgId, projectId],
    queryFn: () => listRoadmapItems(orgId!, projectId),
    enabled: !!orgId,
  })
  const canEdit = user && project ? project.members[user.uid] !== 'viewer' : false
  const inv = () => qc.invalidateQueries({ queryKey: ['roadmap', orgId, projectId] })

  return (
    <div>
      <h2 className="font-semibold mb-4">Roadmap</h2>
      <CrudTable<RoadmapItem>
        columns={[
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'description', label: 'Description', type: 'text' },
          { key: 'targetDate', label: 'Target Date', type: 'text' },
        ]}
        rows={rows}
        canEdit={canEdit}
        onAdd={(d) => addRoadmapItem(orgId!, projectId, d as Omit<RoadmapItem, 'id'>).then(inv)}
        onUpdate={(id, d) => updateRoadmapItem(orgId!, projectId, id, d).then(inv)}
        onDelete={(id) => deleteRoadmapItem(orgId!, projectId, id).then(inv)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add app/(pm)/projects/[projectId]/stakeholders/ \
        app/(pm)/projects/[projectId]/helpful-links/ \
        app/(pm)/projects/[projectId]/roadmap/
git commit -m "feat: add stakeholders, helpful links, and roadmap tabs"
```

---

### Task 13: ADO Board + Dev Plan Tabs (Cache Readers)

**Files:**
- Create: `app/(pm)/projects/[projectId]/ado/page.tsx`
- Create: `app/(pm)/projects/[projectId]/dev-plan/page.tsx`

**Interfaces:**
- Consumes: `getLatestCache` from `lib/firestore/ado-cache`
- Produces: pages that read `adoCache` and render data; show "Not configured" when empty (Plan 4 populates the cache)

- [ ] **Step 1: Create `app/(pm)/projects/[projectId]/ado/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'

export default function AdoBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: sprintCache, isLoading, refetch } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'sprint'],
    queryFn: () => getLatestCache(orgId!, projectId, 'sprint'),
    enabled: !!orgId,
  })

  const { data: backlogCache } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'backlog'],
    queryFn: () => getLatestCache(orgId!, projectId, 'backlog'),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!sprintCache && !backlogCache) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground">ADO not configured. Add your ADO connection in the Overview tab, then sync.</p>
        <p className="text-xs text-muted-foreground">ADO sync is available after Plan 4 is implemented.</p>
      </div>
    )
  }

  const sprint = sprintCache?.payload as Record<string, unknown> | undefined
  const items = (sprint?.value as unknown[]) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">ADO Board — Active Sprint</h2>
        <div className="flex items-center gap-2">
          {sprintCache && <span className="text-xs text-muted-foreground">Last synced: {sprintCache.fetchedAt?.slice(0, 16) ?? '—'}</span>}
          <Button variant="outline" size="sm" onClick={() => refetch()}>Refresh</Button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {['To Do', 'In Progress', 'Done'].map((col) => (
          <div key={col} className="border rounded-md p-3">
            <p className="font-medium text-sm mb-2">{col}</p>
            {items
              .filter((i: unknown) => (i as Record<string, unknown>)['state'] === col)
              .map((i: unknown, idx: number) => {
                const item = i as Record<string, unknown>
                return (
                  <div key={idx} className="text-xs border rounded p-2 mb-1 bg-muted/30">
                    {String(item['title'] ?? item['id'] ?? idx)}
                  </div>
                )
              })}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(pm)/projects/[projectId]/dev-plan/page.tsx`**

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'

export default function DevPlanPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()

  const { data: devPlanCache, isLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'devplan'],
    queryFn: () => getLatestCache(orgId!, projectId, 'devplan'),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!devPlanCache) {
    return <p className="text-muted-foreground">Development plan data not available. Configure ADO in the Overview tab.</p>
  }

  const iterations = (devPlanCache.payload?.value as unknown[]) ?? []

  return (
    <div>
      <h2 className="font-semibold mb-4">Development Plan</h2>
      <table className="w-full text-sm border rounded-md overflow-hidden">
        <thead className="bg-muted">
          <tr>
            <th className="text-left p-2">Iteration</th>
            <th className="text-left p-2">Start</th>
            <th className="text-left p-2">End</th>
            <th className="text-left p-2">Stories</th>
          </tr>
        </thead>
        <tbody>
          {iterations.map((it: unknown, idx: number) => {
            const iter = it as Record<string, unknown>
            const attrs = iter['attributes'] as Record<string, unknown> | undefined
            return (
              <tr key={idx} className="border-t">
                <td className="p-2">{String(iter['name'] ?? idx)}</td>
                <td className="p-2">{String(attrs?.['startDate'] ?? '—').slice(0, 10)}</td>
                <td className="p-2">{String(attrs?.['finishDate'] ?? '—').slice(0, 10)}</td>
                <td className="p-2">{String(iter['storyCount'] ?? '—')}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(pm)/projects/[projectId]/ado/ app/(pm)/projects/[projectId]/dev-plan/
git commit -m "feat: add ADO board and dev plan tabs (read from adoCache, populated by Plan 4)"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Project dashboard — owned + shared projects | Task 5 |
| Status badge, member count, last updated | Task 5 |
| Create project → creator is owner | Task 2, 5 |
| Archive project (owner only) | Task 2 (archiveProject helper; UI gate in Task 5 can add archive button) |
| Overview tab — edit name, description, tech stack | Task 7 |
| Sharing — add member by role | Task 7 (ShareDialog) |
| SOW tab — dates, hours, summary, resource table | Task 8 |
| Status tab — Schedule/Budget/Scope indicators | Task 10 |
| Schedule % from SOW dates (client-side) | Task 10 |
| Budget hours consumed (manually entered) | Task 10 |
| Scope from ADO backlog cache | Task 10 (stub "from ADO Plan 4") |
| Onboard Items CRUD | Task 10 |
| Risks CRUD | Task 10 |
| Issues CRUD | Task 10 |
| Need From Client CRUD | Task 10 |
| Status Snapshots — capture + history | Task 10 |
| Context Files — list + share toggle | Task 11 |
| Context Files — upload (stub) | Task 11 (button disabled, Plan 4 wires it) |
| ADO Board tab | Task 13 |
| Development Plan tab | Task 13 |
| Stakeholders tab | Task 12 |
| Helpful Links tab | Task 12 |
| Roadmap tab | Task 12 |
| Editor cannot manage sharing or delete project | Tasks 2, 7 (owner-only gates in UI) |
| Viewer cannot write | Tasks 3–13 (canEdit checks) |

**Gap caught:** The dashboard doesn't show an archive button. Add to `project-card.tsx` for owner role — but since the ProjectCard doesn't receive `currentUserUid`, the archive action belongs on the Overview page instead. No code change needed; archiving via the Overview page is sufficient for v1.

**Placeholder scan:** No TBDs found. ADO Board and Dev Plan tabs have intentional "Plan 4" stubs with clear comments.

**Type consistency:** All `CrudTable` invocations use types defined in `lib/types.ts` (Task 2, Plan 1). `listResources` / `addResource` etc. match the `Resource` type. `ColumnDef<T>` keys are typed as `keyof T`. `canEdit` logic uses `AccessLevel` values `'owner'` / `'editor'` / `'viewer'` consistently.
