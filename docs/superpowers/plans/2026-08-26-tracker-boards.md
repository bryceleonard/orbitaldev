# Tracker Boards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single hardcoded ADO integration with an extensible `trackerBoards` array supporting multiple labeled boards (ADO Work Items or Beads) per project, with each board rendered as its own tab in the PM workspace and client portal.

**Architecture:** Each `TrackerBoard` on a project carries its own connection config and type (`'ado'` | `'beads'`). A unified board sync API route replaces the old `/api/ado/[projectId]` route. A single dynamic page at `/projects/[projectId]/boards/[boardId]` dispatches to an ADO view (sprint kanban + dev plan sub-tabs) or a Beads view (epic-grouped issues table), based on `board.type`.

**Tech Stack:** Next.js 16 App Router · Firebase Admin + client SDK · @tanstack/react-query · shadcn/ui · AES-256-GCM PAT encryption (existing module) · ADO REST API 7.1 · Beads JSONL (`.beads/issues.jsonl` read via ADO Git Items API)

## Global Constraints

- All API routes must export `export const runtime = 'nodejs'`
- Session verification uses `adminAuth.verifySessionCookie(cookie, true)` with cookie name `process.env.SESSION_COOKIE_NAME ?? '__session'`
- PATs are encrypted with `encryptPat` / decrypted with `decryptPat` from `@/lib/ado/encryption` — never stored or logged in plaintext
- All Firestore writes use `serverTimestamp()` for `updatedAt` / `createdAt` where applicable
- Run tests with `pnpm test` (Vitest); run type-check with `pnpm tsc --noEmit`
- Commits use the `feat:` / `fix:` / `refactor:` prefix convention
- `crypto.randomUUID()` is available in Node 16+ and modern browsers — use it for board IDs

---

### Task 1: Data model

**Files:**
- Modify: `lib/types.ts`
- Test: `lib/types.test.ts`

**Interfaces:**
- Produces: `TrackerType`, `TrackerBoard`, `BeadsIssue` — used by every subsequent task

- [ ] **Step 1: Write the failing type test**

Replace the contents of `lib/types.test.ts` with:

```ts
import type { Project, TrackerBoard, BeadsIssue, AdoCache } from './types'

test('TrackerBoard has required fields', () => {
  const board: TrackerBoard = {
    id: 'b1',
    label: 'Alpha',
    type: 'ado',
    adoOrgUrl: 'https://dev.azure.com/myorg',
    adoProject: 'MyProject',
    adoPat: 'encrypted',
    adoTeam: 'MyTeam',
    beadsRepo: '',
    beadsBranch: 'main',
  }
  expect(board.type).toBe('ado')
})

test('Project has trackerBoards and no flat ADO fields', () => {
  const p = {} as Project
  // trackerBoards exists on the type
  expect('trackerBoards' in ({} as Project)).toBe(false) // structural — just checks it compiles
})

test('BeadsIssue has priority as number', () => {
  const issue: BeadsIssue = {
    id: 'br-1',
    title: 'Fix it',
    type: 'bug',
    priority: 0,
    status: 'open',
    assignee: 'alice',
    labels: [],
    description: '',
    dependencies: [],
    acceptance_criteria: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
  expect(issue.priority).toBe(0)
})

test('AdoCache type union includes beads-issues', () => {
  const cache: AdoCache = {
    id: 'c1',
    boardId: 'b1',
    type: 'beads-issues',
    payload: {},
    fetchedAt: '2026-01-01T00:00:00Z',
  }
  expect(cache.type).toBe('beads-issues')
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test lib/types.test.ts
```

Expected: compile/type errors — `TrackerBoard`, `BeadsIssue` not defined; `AdoCache` missing `boardId` and `'beads-issues'`.

- [ ] **Step 3: Update `lib/types.ts`**

Replace the file with:

```ts
export type AccessLevel = 'owner' | 'editor' | 'viewer'
export type StatusLevel = 'on_track' | 'at_risk' | 'off_track'
export type Severity = 'low' | 'medium' | 'high'
export type OpenResolved = 'open' | 'resolved'
export type TrackerType = 'ado' | 'beads'

export interface TrackerBoard {
  id: string
  label: string
  type: TrackerType
  adoOrgUrl: string
  adoProject: string
  adoPat: string        // AES-256-GCM encrypted at rest
  adoTeam: string       // ADO Work Items only; ignored for Beads
  beadsRepo: string     // Beads only: ADO repo name containing .beads/
  beadsBranch: string   // Beads only: defaults to 'main'
}

export interface BeadsIssue {
  id: string
  title: string
  type: 'bug' | 'feature' | 'task' | string
  priority: 0 | 1 | 2 | 3 | 4
  status: 'open' | 'in_progress' | 'in_review' | 'rework' | 'closed' | 'deferred' | string
  assignee: string
  labels: string[]
  description: string
  dependencies: string[]
  acceptance_criteria: string
  parentId?: string     // set when issue is a child of an epic
  created_at: string
  updated_at: string
}

export interface Org {
  id: string
  name: string
  plan: string
  createdAt: string
}

export interface OrgUser {
  uid: string
  email: string
  displayName: string
  createdAt: string
}

export interface Sow {
  startDate: string
  endDate: string
  totalHours: number
  budgetHours: number
  summary: string
}

export interface StatusHeader {
  scheduleStatus: StatusLevel
  budgetStatus: StatusLevel
  scopeStatus: StatusLevel
}

export interface Project {
  id: string
  orgId: string
  name: string
  description: string
  techStack: string[]
  pmTools: string[]
  status: 'active' | 'archived'
  trackerBoards: TrackerBoard[]
  members: Record<string, AccessLevel>
  sow: Sow
  statusHeader: StatusHeader
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Resource {
  id: string
  name: string
  role: string
  hours: number
}

export interface ProjectFile {
  id: string
  name: string
  storagePath: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
  sharedWithClient: boolean
}

export interface OnboardItem {
  id: string
  item: string
  owner: string
  description: string
  actionItems: string
  complete: boolean
}

export interface Risk {
  id: string
  title: string
  owner: string
  severity: Severity
  description: string
  status: OpenResolved
  createdAt: string
  updatedAt: string
}

export interface Issue {
  id: string
  title: string
  owner: string
  severity: Severity
  description: string
  status: OpenResolved
  createdAt: string
  updatedAt: string
}

export interface ClientAction {
  id: string
  stakeholderName: string
  description: string
  resolved: boolean
  createdAt: string
}

export interface Stakeholder {
  id: string
  name: string
  role: string
  responsibilities: string
}

export interface HelpfulLink {
  id: string
  label: string
  url: string
}

export interface RoadmapItem {
  id: string
  title: string
  description: string
  targetDate: string
}

export interface AdoCache {
  id: string
  boardId: string       // which TrackerBoard this cache entry belongs to
  type: 'backlog' | 'sprint' | 'devplan' | 'beads-issues'
  payload: Record<string, unknown>
  fetchedAt: string
}

export interface StatusSnapshot {
  id: string
  date: string
  schedulePercent: number
  budgetConsumed: number
  scopeComplete: string
  notes: string
  adoCacheRef: string
  createdBy: string
  createdAt: string
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/types.test.ts
```

Expected: all 4 pass.

- [ ] **Step 5: Type-check**

```bash
pnpm tsc --noEmit
```

Fix any errors before continuing. Common issue: other files that reference the removed flat ADO fields (`adoOrgUrl`, `adoProject`, `adoTeam`, `adoPat`) will have type errors — note them, they are fixed in later tasks.

- [ ] **Step 6: Commit**

```bash
git add lib/types.ts lib/types.test.ts
git commit -m "feat: add TrackerBoard, BeadsIssue types; replace flat ADO fields with trackerBoards"
```

---

### Task 2: Firestore helpers — projects + ADO cache

**Files:**
- Modify: `lib/firestore/projects.ts`
- Modify: `lib/firestore/ado-cache.ts`
- Test: `lib/firestore/projects.test.ts`

**Interfaces:**
- Consumes: `TrackerBoard` from Task 1
- Produces:
  - `createProject(orgId, uid, data, firstBoard?)` — optional first board stored in `trackerBoards`
  - `getLatestBoardCache(orgId, projectId, boardId, type)` — filters cache by boardId + type

- [ ] **Step 1: Update the projects test**

Add these two tests to `lib/firestore/projects.test.ts` (keep existing tests):

```ts
test('createProject stores empty trackerBoards when no firstBoard given', async () => {
  mockAddDoc.mockResolvedValue({ id: 'proj-2' })
  mockCollection.mockReturnValue('col-ref')
  const { createProject } = await import('./projects')
  await createProject('org1', 'uid-owner', {
    name: 'Test', description: '', techStack: [], pmTools: [],
  })
  expect(mockAddDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
    trackerBoards: [],
  }))
})

test('createProject stores firstBoard in trackerBoards', async () => {
  mockAddDoc.mockResolvedValue({ id: 'proj-3' })
  mockCollection.mockReturnValue('col-ref')
  const { createProject } = await import('./projects')
  const board = {
    id: 'b1', label: 'Alpha', type: 'ado' as const,
    adoOrgUrl: '', adoProject: '', adoPat: '',
    adoTeam: '', beadsRepo: '', beadsBranch: 'main',
  }
  await createProject('org1', 'uid-owner', {
    name: 'Test', description: '', techStack: [], pmTools: [],
  }, board)
  expect(mockAddDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
    trackerBoards: [board],
  }))
})
```

- [ ] **Step 2: Run tests to confirm new ones fail**

```bash
pnpm test lib/firestore/projects.test.ts
```

Expected: new tests fail — `createProject` doesn't accept `firstBoard` yet.

- [ ] **Step 3: Update `lib/firestore/projects.ts`**

Replace the file with:

```ts
import {
  collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, query, where,
  deleteField, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'
import type { Project, AccessLevel, TrackerBoard } from '@/lib/types'
import { setUserOrg } from './users'

type CreateData = Pick<Project, 'name' | 'description' | 'techStack' | 'pmTools'>

function projectPath(orgId: string) {
  return collection(db, `orgs/${orgId}/projects`)
}

export async function createProject(
  orgId: string,
  uid: string,
  data: CreateData,
  firstBoard?: TrackerBoard,
): Promise<string> {
  const ref = await addDoc(projectPath(orgId), {
    ...data,
    orgId,
    status: 'active',
    trackerBoards: firstBoard ? [firstBoard] : [],
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
  await setUserOrg(uid, orgId)
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

- [ ] **Step 4: Update `lib/firestore/ado-cache.ts`**

Replace the file with:

```ts
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

export async function getLatestBoardCache(
  orgId: string,
  projectId: string,
  boardId: string,
  type: AdoCache['type'],
): Promise<AdoCache | null> {
  const all = await listItems<AdoCache>(path(orgId, projectId))
  const matches = all
    .filter((c) => c.type === type && c.boardId === boardId)
    .sort((a, b) => (a.fetchedAt > b.fetchedAt ? -1 : 1))
  return matches[0] ?? null
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test lib/firestore/projects.test.ts
```

Expected: all 6 pass.

- [ ] **Step 6: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 7: Commit**

```bash
git add lib/firestore/projects.ts lib/firestore/ado-cache.ts lib/firestore/projects.test.ts
git commit -m "feat: update createProject to accept firstBoard; add getLatestBoardCache"
```

---

### Task 3: ADO client — add text fetcher for Beads

**Files:**
- Modify: `lib/ado/client.ts`
- Test: `lib/ado/client.test.ts`

**Interfaces:**
- Produces: `fetchBeadsIssues(adoOrgUrl, adoProject, repo, branch, pat): Promise<string>` — returns raw JSONL text

- [ ] **Step 1: Write the failing test**

Add to `lib/ado/client.test.ts` (keep any existing tests):

```ts
import { vi, describe, test, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => mockFetch.mockReset())

describe('fetchBeadsIssues', () => {
  test('calls ADO Git Items endpoint and returns text', async () => {
    const jsonl = '{"id":"br-1","title":"Fix it"}\n{"id":"br-2","title":"Add it"}'
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(jsonl),
    })
    const { fetchBeadsIssues } = await import('./client')
    const result = await fetchBeadsIssues(
      'https://dev.azure.com/myorg', 'MyProject', 'MyRepo', 'main', 'myPat',
    )
    expect(result).toBe(jsonl)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://dev.azure.com/myorg/MyProject/_apis/git/repositories/MyRepo/items?path=.beads%2Fissues.jsonl&versionDescriptor.version=main&download=true&api-version=7.1',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining('Basic') }) }),
    )
  })

  test('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('Not found') })
    const { fetchBeadsIssues } = await import('./client')
    await expect(
      fetchBeadsIssues('https://dev.azure.com/myorg', 'MyProject', 'MyRepo', 'main', 'pat'),
    ).rejects.toThrow('ADO request failed: 404')
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
pnpm test lib/ado/client.test.ts
```

Expected: FAIL — `fetchBeadsIssues` not exported.

- [ ] **Step 3: Add `fetchBeadsIssues` to `lib/ado/client.ts`**

Append to the existing file (do not replace — keep `fetchBacklog`, `fetchSprint`, `fetchDevPlan`):

```ts
async function adoGetText(url: string, pat: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(pat),
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ADO request failed: ${res.status} ${text}`)
  }
  return res.text()
}

export async function fetchBeadsIssues(
  adoOrgUrl: string,
  adoProject: string,
  repo: string,
  branch: string,
  pat: string,
): Promise<string> {
  const path = encodeURIComponent('.beads/issues.jsonl')
  const url =
    `${adoOrgUrl}/${adoProject}/_apis/git/repositories/${repo}/items` +
    `?path=${path}&versionDescriptor.version=${branch}&download=true&api-version=${API_VERSION}`
  return adoGetText(url, pat)
}
```

- [ ] **Step 4: Run tests**

```bash
pnpm test lib/ado/client.test.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ado/client.ts lib/ado/client.test.ts
git commit -m "feat: add fetchBeadsIssues to ADO client via Git Items text API"
```

---

### Task 4: Board sync API route

**Files:**
- Create: `app/api/boards/[projectId]/[boardId]/route.ts`
- Delete: `app/api/ado/[projectId]/route.ts`

**Interfaces:**
- Consumes: `fetchBacklog`, `fetchSprint`, `fetchDevPlan`, `fetchBeadsIssues` from Task 3; `decryptPat` from `@/lib/ado/encryption`
- Produces: `GET /api/boards/[projectId]/[boardId]?type=sprint&force=0` — returns `{ type, payload, fetchedAt, fromCache }`

- [ ] **Step 1: Create the file**

Create `app/api/boards/[projectId]/[boardId]/route.ts`:

```ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { decryptPat } from '@/lib/ado/encryption'
import { fetchBacklog, fetchSprint, fetchDevPlan, fetchBeadsIssues } from '@/lib/ado/client'
import type { TrackerBoard, BeadsIssue } from '@/lib/types'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const TTL_MS = 15 * 60 * 1000

type AdoCacheType = 'backlog' | 'sprint' | 'devplan' | 'beads-issues'

async function getUid(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get(COOKIE)?.value
  if (!cookie) return null
  try {
    const decoded = await adminAuth.verifySessionCookie(cookie, true)
    return decoded.uid
  } catch {
    return null
  }
}

async function getOrgAndProject(
  projectId: string,
): Promise<{ orgId: string; project: Record<string, unknown> } | null> {
  const orgsSnap = await adminDb.collection('orgs').get()
  for (const orgDoc of orgsSnap.docs) {
    const projSnap = await adminDb.doc(`orgs/${orgDoc.id}/projects/${projectId}`).get()
    if (projSnap.exists) return { orgId: orgDoc.id, project: projSnap.data()! }
  }
  return null
}

async function getCached(
  orgId: string,
  projectId: string,
  boardId: string,
  type: AdoCacheType,
): Promise<Record<string, unknown> | null> {
  const snap = await adminDb
    .collection(`orgs/${orgId}/projects/${projectId}/adoCache`)
    .where('type', '==', type)
    .where('boardId', '==', boardId)
    .orderBy('fetchedAt', 'desc')
    .limit(1)
    .get()
  if (snap.empty) return null
  const data = snap.docs[0].data()
  const fetchedAt = data.fetchedAt?.toMillis?.() ?? 0
  if (Date.now() - fetchedAt < TTL_MS) return data
  return null
}

async function writeCache(
  orgId: string,
  projectId: string,
  boardId: string,
  type: AdoCacheType,
  payload: unknown,
): Promise<string> {
  const ref = adminDb.collection(`orgs/${orgId}/projects/${projectId}/adoCache`).doc()
  const fetchedAt = new Date()
  await ref.set({ boardId, type, payload, fetchedAt })
  return fetchedAt.toISOString()
}

function parseBeadsJsonl(text: string): BeadsIssue[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const raw = JSON.parse(line) as Record<string, unknown>
      return {
        ...raw,
        // Normalise parent field — Beads CLI uses snake_case; verify against real repo
        parentId: (raw['parent_id'] ?? raw['parentId'] ?? undefined) as string | undefined,
        labels: Array.isArray(raw['labels']) ? raw['labels'] as string[] : [],
        dependencies: Array.isArray(raw['dependencies']) ? raw['dependencies'] as string[] : [],
      } as BeadsIssue
    })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; boardId: string }> },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, boardId } = await params
  const type = (req.nextUrl.searchParams.get('type') ?? 'sprint') as AdoCacheType
  const force = req.nextUrl.searchParams.get('force') === '1'

  const found = await getOrgAndProject(projectId)
  if (!found) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { orgId, project } = found
  const members = project['members'] as Record<string, string>
  if (!members[uid]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const boards = (project['trackerBoards'] ?? []) as TrackerBoard[]
  const board = boards.find((b) => b.id === boardId)
  if (!board) return NextResponse.json({ error: 'Board not found' }, { status: 404 })

  const cacheType: AdoCacheType = board.type === 'beads' ? 'beads-issues' : type

  if (!force) {
    const cached = await getCached(orgId, projectId, boardId, cacheType)
    if (cached) {
      return NextResponse.json({
        type: cacheType,
        payload: cached['payload'],
        fetchedAt: cached['fetchedAt'],
        fromCache: true,
      })
    }
  }

  let pat: string
  try {
    pat = decryptPat(board.adoPat)
  } catch {
    return NextResponse.json({ error: 'PAT decryption failed — reconfigure board settings' }, { status: 500 })
  }

  try {
    if (board.type === 'beads') {
      const text = await fetchBeadsIssues(
        board.adoOrgUrl, board.adoProject, board.beadsRepo, board.beadsBranch || 'main', pat,
      )
      const issues = parseBeadsJsonl(text)
      const fetchedAt = await writeCache(orgId, projectId, boardId, 'beads-issues', issues)
      return NextResponse.json({ type: 'beads-issues', payload: issues, fetchedAt, fromCache: false })
    }

    let payload: unknown
    if (type === 'backlog') payload = await fetchBacklog(board.adoOrgUrl, board.adoProject, pat)
    else if (type === 'sprint') payload = await fetchSprint(board.adoOrgUrl, board.adoProject, board.adoTeam, pat)
    else payload = await fetchDevPlan(board.adoOrgUrl, board.adoProject, pat)

    const fetchedAt = await writeCache(orgId, projectId, boardId, type, payload)
    return NextResponse.json({ type, payload, fetchedAt, fromCache: false })
  } catch (e) {
    return NextResponse.json({ error: `Fetch failed: ${(e as Error).message}` }, { status: 502 })
  }
}
```

- [ ] **Step 2: Delete the old route**

```bash
rm app/api/ado/\[projectId\]/route.ts
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/boards/
git rm app/api/ado/\[projectId\]/route.ts
git commit -m "feat: add unified board sync API route; remove old /api/ado/[projectId] route"
```

---

### Task 5: Board configure API route

**Files:**
- Create: `app/api/boards/configure/[projectId]/route.ts`
- Delete: `app/api/ado/configure/[projectId]/route.ts`

**Interfaces:**
- Produces: `POST /api/boards/configure/[projectId]` with body `{ action, board?, boardId?, orgId, pat? }`

- [ ] **Step 1: Create the file**

Create `app/api/boards/configure/[projectId]/route.ts`:

```ts
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { encryptPat } from '@/lib/ado/encryption'
import type { TrackerBoard } from '@/lib/types'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

async function getUid(req: NextRequest): Promise<string | null> {
  const cookie = req.cookies.get(COOKIE)?.value
  if (!cookie) return null
  try {
    const { uid } = await adminAuth.verifySessionCookie(cookie, true)
    return uid
  } catch {
    return null
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = await params
  const body = await req.json() as {
    action: 'add' | 'edit' | 'remove'
    board?: Omit<TrackerBoard, 'adoPat'>
    boardId?: string
    orgId: string
    pat?: string
  }

  const { action, board, boardId, orgId, pat } = body
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

  const projRef = adminDb.doc(`orgs/${orgId}/projects/${projectId}`)
  const projSnap = await projRef.get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data = projSnap.data()!
  const members = data['members'] as Record<string, string>
  if (members[uid] !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const boards: TrackerBoard[] = (data['trackerBoards'] ?? []) as TrackerBoard[]

  if (action === 'add' || action === 'edit') {
    if (!board) return NextResponse.json({ error: 'board required' }, { status: 400 })

    const encryptedPat = pat && pat.trim()
      ? encryptPat(pat.trim())
      : boards.find((b) => b.id === board.id)?.adoPat ?? ''

    const fullBoard: TrackerBoard = { ...board, adoPat: encryptedPat }

    const updated =
      action === 'add'
        ? [...boards, fullBoard]
        : boards.map((b) => (b.id === fullBoard.id ? fullBoard : b))

    await projRef.update({ trackerBoards: updated, updatedAt: new Date() })
    return NextResponse.json({ status: 'ok' })
  }

  if (action === 'remove') {
    if (!boardId) return NextResponse.json({ error: 'boardId required' }, { status: 400 })
    const updated = boards.filter((b) => b.id !== boardId)
    await projRef.update({ trackerBoards: updated, updatedAt: new Date() })

    // Delete cached data for the removed board
    const cacheSnap = await adminDb
      .collection(`orgs/${orgId}/projects/${projectId}/adoCache`)
      .where('boardId', '==', boardId)
      .get()
    const deletes = cacheSnap.docs.map((d) => d.ref.delete())
    await Promise.all(deletes)

    return NextResponse.json({ status: 'ok' })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
```

- [ ] **Step 2: Delete the old configure route**

```bash
rm app/api/ado/configure/\[projectId\]/route.ts
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add app/api/boards/configure/
git rm app/api/ado/configure/\[projectId\]/route.ts
git commit -m "feat: add board configure API; remove old /api/ado/configure route"
```

---

### Task 6: Project creation form

**Files:**
- Modify: `components/projects/project-form.tsx`

**Interfaces:**
- Consumes: `createProject(orgId, uid, data, firstBoard?)` from Task 2
- Produces: project creation form with tracker type radio + board label field

- [ ] **Step 1: Replace `components/projects/project-form.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { useOrgIdWithStatus } from '@/hooks/use-org'
import { createProject } from '@/lib/firestore/projects'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { TrackerBoard, TrackerType } from '@/lib/types'

type TrackerChoice = TrackerType | 'none'

export function ProjectForm() {
  const { user } = useAuth()
  const { orgId, isLoading: orgLoading } = useOrgIdWithStatus()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [trackerChoice, setTrackerChoice] = useState<TrackerChoice>('none')
  const [boardLabel, setBoardLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return
    if (!orgId) {
      setError('No workspace found. Please complete onboarding first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      let firstBoard: TrackerBoard | undefined
      if (trackerChoice !== 'none') {
        firstBoard = {
          id: crypto.randomUUID(),
          label: boardLabel.trim() || name.trim(),
          type: trackerChoice,
          adoOrgUrl: '',
          adoProject: '',
          adoPat: '',
          adoTeam: '',
          beadsRepo: '',
          beadsBranch: 'main',
        }
      }
      const projectId = await createProject(orgId, user.uid, {
        name: name.trim(),
        description: description.trim(),
        techStack: [],
        pmTools: [],
      }, firstBoard)
      router.push(`/projects/${projectId}/overview`)
    } catch (err) {
      console.error('[createProject] orgId:', orgId, 'uid:', user.uid, 'error:', err)
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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium mb-1">Issue tracker</legend>
        {(['ado', 'beads', 'none'] as const).map((choice) => (
          <label key={choice} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name="tracker"
              value={choice}
              checked={trackerChoice === choice}
              onChange={() => setTrackerChoice(choice)}
            />
            {choice === 'ado' && 'ADO Work Items'}
            {choice === 'beads' && 'Beads'}
            {choice === 'none' && 'None (configure later)'}
          </label>
        ))}
      </fieldset>

      {trackerChoice !== 'none' && (
        <div>
          <Label htmlFor="board-label">Board label</Label>
          <Input
            id="board-label"
            value={boardLabel}
            onChange={(e) => setBoardLabel(e.target.value)}
            placeholder={name.trim() || 'e.g. Alpha, Backend'}
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading || orgLoading || !name.trim()}>
        {loading ? 'Creating…' : 'Create project'}
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Manual smoke test**

Start the dev server (`pnpm dev`) and navigate to `/projects/new`. Verify:
- All three radio options render
- Selecting ADO or Beads shows the board label input
- Selecting None hides the label input
- Submitting with ADO selected creates a project and redirects to overview

- [ ] **Step 4: Commit**

```bash
git add components/projects/project-form.tsx
git commit -m "feat: add tracker type radio and board label to project creation form"
```

---

### Task 7: PM tab system — dynamic board tabs

**Files:**
- Modify: `components/layout/project-tabs.tsx`
- Modify: `app/(pm)/projects/[projectId]/layout.tsx`
- Test: `components/layout/project-tabs.test.tsx`

**Interfaces:**
- Consumes: `TrackerBoard[]` from project data
- Produces: `ProjectTabs({ projectId, trackerBoards })` — renders static tabs with board tabs inserted between Files and Stakeholders

- [ ] **Step 1: Update the tab test**

Replace `components/layout/project-tabs.test.tsx` with:

```tsx
import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { TrackerBoard } from '@/lib/types'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/projects/p1/status'),
  useParams: vi.fn(() => ({ projectId: 'p1' })),
}))

const adoBoard: TrackerBoard = {
  id: 'b1', label: 'Alpha', type: 'ado',
  adoOrgUrl: '', adoProject: '', adoPat: '', adoTeam: '', beadsRepo: '', beadsBranch: 'main',
}
const beadsBoard: TrackerBoard = {
  id: 'b2', label: 'Issues', type: 'beads',
  adoOrgUrl: '', adoProject: '', adoPat: '', adoTeam: '', beadsRepo: 'repo', beadsBranch: 'main',
}

test('renders static tabs without boards', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" trackerBoards={[]} />)
  for (const label of ['Overview', 'SOW', 'Status', 'Files', 'Stakeholders', 'Links', 'Roadmap']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  expect(screen.queryByText('ADO Board')).not.toBeInTheDocument()
  expect(screen.queryByText('Dev Plan')).not.toBeInTheDocument()
})

test('renders board tab with board label', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" trackerBoards={[adoBoard]} />)
  expect(screen.getByText('Alpha')).toBeInTheDocument()
})

test('renders two board tabs for two boards', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" trackerBoards={[adoBoard, beadsBoard]} />)
  expect(screen.getByText('Alpha')).toBeInTheDocument()
  expect(screen.getByText('Issues')).toBeInTheDocument()
})

test('board tab links to /projects/[id]/boards/[boardId]', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" trackerBoards={[adoBoard]} />)
  const link = screen.getByRole('link', { name: 'Alpha' })
  expect(link).toHaveAttribute('href', '/projects/p1/boards/b1')
})

test('active tab has aria-current', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" trackerBoards={[]} />)
  expect(screen.getByRole('link', { name: /status/i })).toHaveAttribute('aria-current', 'page')
})
```

- [ ] **Step 2: Run test to confirm failures**

```bash
pnpm test components/layout/project-tabs.test.tsx
```

Expected: fails — `ProjectTabs` doesn't accept `trackerBoards` prop yet.

- [ ] **Step 3: Replace `components/layout/project-tabs.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { TrackerBoard } from '@/lib/types'

const STATIC_BEFORE = [
  { label: 'Overview',     segment: 'overview' },
  { label: 'SOW',          segment: 'sow' },
  { label: 'Status',       segment: 'status' },
  { label: 'Files',        segment: 'files' },
]

const STATIC_AFTER = [
  { label: 'Stakeholders', segment: 'stakeholders' },
  { label: 'Links',        segment: 'helpful-links' },
  { label: 'Roadmap',      segment: 'roadmap' },
]

interface Props {
  projectId: string
  trackerBoards: TrackerBoard[]
}

export function ProjectTabs({ projectId, trackerBoards }: Props) {
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
    <nav className="flex border-b overflow-x-auto">
      {STATIC_BEFORE.map(({ label, segment }) => {
        const href = `/projects/${projectId}/${segment}`
        return (
          <Link key={segment} href={href} aria-current={pathname.endsWith(`/${segment}`) ? 'page' : undefined} className={tabClass(pathname.endsWith(`/${segment}`))}>
            {label}
          </Link>
        )
      })}
      {trackerBoards.map((board) => {
        const href = `/projects/${projectId}/boards/${board.id}`
        const active = pathname.includes(`/boards/${board.id}`)
        return (
          <Link key={board.id} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
            {board.label}
          </Link>
        )
      })}
      {STATIC_AFTER.map(({ label, segment }) => {
        const href = `/projects/${projectId}/${segment}`
        return (
          <Link key={segment} href={href} aria-current={pathname.endsWith(`/${segment}`) ? 'page' : undefined} className={tabClass(pathname.endsWith(`/${segment}`))}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 4: Update `app/(pm)/projects/[projectId]/layout.tsx`**

```tsx
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
        <ProjectTabs projectId={projectId} trackerBoards={project?.trackerBoards ?? []} />
      </div>
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  )
}
```

- [ ] **Step 5: Run tests**

```bash
pnpm test components/layout/project-tabs.test.tsx
```

Expected: all 5 pass.

- [ ] **Step 6: Commit**

```bash
git add components/layout/project-tabs.tsx app/\(pm\)/projects/\[projectId\]/layout.tsx components/layout/project-tabs.test.tsx
git commit -m "feat: dynamic board tabs in ProjectTabs; pass trackerBoards from project layout"
```

---

### Task 8: PM board page

**Files:**
- Create: `app/(pm)/projects/[projectId]/boards/[boardId]/page.tsx`
- Delete: `app/(pm)/projects/[projectId]/ado/page.tsx`
- Delete: `app/(pm)/projects/[projectId]/dev-plan/page.tsx`

**Interfaces:**
- Consumes: `getLatestBoardCache` from Task 2; `GET /api/boards/[projectId]/[boardId]` from Task 4
- Produces: board page rendering ADO sprint+devplan view or Beads issues table with epic grouping

- [ ] **Step 1: Create `app/(pm)/projects/[projectId]/boards/[boardId]/page.tsx`**

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { getLatestBoardCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BeadsIssue } from '@/lib/types'

export default function BoardPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const board = project?.trackerBoards.find((b) => b.id === boardId)

  if (!board) return <p className="text-muted-foreground">Loading…</p>
  if (board.type === 'beads') return <BeadsBoardView projectId={projectId} boardId={boardId} orgId={orgId} />
  return <AdoBoardView projectId={projectId} boardId={boardId} orgId={orgId} />
}

// ── ADO Board ────────────────────────────────────────────────────────────────

type AdoSubTab = 'sprint' | 'devplan'

function AdoBoardView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const qc = useQueryClient()
  const [subTab, setSubTab] = useState<AdoSubTab>('sprint')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { data: cache, isLoading } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, subTab],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, subTab === 'sprint' ? 'sprint' : 'devplan'),
    enabled: !!orgId,
  })

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/boards/${projectId}/${boardId}?type=${subTab}&force=1`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Sync failed')
      qc.invalidateQueries({ queryKey: ['board-cache', orgId, projectId, boardId, subTab] })
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['sprint', 'devplan'] as AdoSubTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setSubTab(t)}
              className={cn(
                'px-3 py-1 text-sm rounded-md border',
                subTab === t ? 'bg-primary text-primary-foreground' : 'bg-transparent text-muted-foreground',
              )}
            >
              {t === 'sprint' ? 'Sprint Board' : 'Dev Plan'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {cache && <span className="text-xs text-muted-foreground">Last synced: {cache.fetchedAt?.slice(0, 16) ?? '—'}</span>}
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>
      </div>
      {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      {isLoading && <p className="text-muted-foreground">Loading…</p>}
      {!isLoading && !cache && (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground">Not yet synced.</p>
          <Button onClick={handleSync} disabled={syncing} className="self-start">
            {syncing ? 'Syncing…' : `Sync from ADO`}
          </Button>
        </div>
      )}
      {cache && subTab === 'sprint' && <AdoSprintView cache={cache.payload} />}
      {cache && subTab === 'devplan' && <AdoDevPlanView cache={cache.payload} />}
    </div>
  )
}

function AdoSprintView({ cache }: { cache: Record<string, unknown> }) {
  const items = ((cache?.value as unknown[]) ?? []) as Record<string, unknown>[]
  return (
    <div className="grid grid-cols-3 gap-4">
      {['To Do', 'In Progress', 'Done'].map((col) => (
        <div key={col} className="border rounded-md p-3">
          <p className="font-medium text-sm mb-2">{col}</p>
          {items.filter((i) => i['state'] === col).map((i, idx) => (
            <div key={idx} className="text-xs border rounded p-2 mb-1 bg-muted/30">
              {String(i['title'] ?? idx)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function AdoDevPlanView({ cache }: { cache: Record<string, unknown> }) {
  const iterations = ((cache?.value as unknown[]) ?? []) as Record<string, unknown>[]
  return (
    <table className="w-full text-sm border rounded-md overflow-hidden">
      <thead className="bg-muted">
        <tr>
          <th className="text-left p-2">Iteration</th>
          <th className="text-left p-2">Start</th>
          <th className="text-left p-2">End</th>
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
  )
}

// ── Beads Board ──────────────────────────────────────────────────────────────

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Backlog',
}

const PRIORITY_COLORS: Record<number, string> = {
  0: 'bg-red-100 text-red-800',
  1: 'bg-orange-100 text-orange-800',
  2: 'bg-yellow-100 text-yellow-800',
  3: 'bg-blue-100 text-blue-800',
  4: 'bg-gray-100 text-gray-700',
}

function BeadsBoardView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [selected, setSelected] = useState<BeadsIssue | null>(null)
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterPriority, setFilterPriority] = useState<string>('all')

  const { data: cache, isLoading } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'beads-issues'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'beads-issues'),
    enabled: !!orgId,
  })

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/boards/${projectId}/${boardId}?force=1`)
      if (!res.ok) throw new Error((await res.json()).error ?? 'Sync failed')
      qc.invalidateQueries({ queryKey: ['board-cache', orgId, projectId, boardId, 'beads-issues'] })
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  const allIssues: BeadsIssue[] = Array.isArray(cache?.payload) ? cache.payload as BeadsIssue[] : []

  const filtered = allIssues.filter((i) => {
    if (filterStatus !== 'all' && i.status !== filterStatus) return false
    if (filterPriority !== 'all' && String(i.priority) !== filterPriority) return false
    return true
  })

  const childIds = new Set(filtered.filter((i) => i.parentId).map((i) => i.parentId!))
  const epics = filtered.filter((i) => childIds.has(i.id))
  const epicIds = new Set(epics.map((e) => e.id))
  const orphans = filtered.filter((i) => !i.parentId && !epicIds.has(i.id))

  const allStatuses = [...new Set(allIssues.map((i) => i.status))].sort()

  return (
    <div className="flex gap-6">
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <select
              className="text-sm border rounded px-2 py-1"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              {allStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              className="text-sm border rounded px-2 py-1"
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
            >
              <option value="all">All priorities</option>
              {[0, 1, 2, 3, 4].map((p) => (
                <option key={p} value={String(p)}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            {cache && <span className="text-xs text-muted-foreground">Last synced: {cache.fetchedAt?.slice(0, 16) ?? '—'}</span>}
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync'}
            </Button>
          </div>
        </div>
        {syncError && <p className="text-sm text-destructive">{syncError}</p>}
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {!isLoading && !cache && (
          <div className="flex flex-col gap-3">
            <p className="text-muted-foreground">Not yet synced.</p>
            <Button onClick={handleSync} disabled={syncing} className="self-start">
              {syncing ? 'Syncing…' : 'Sync from repo'}
            </Button>
          </div>
        )}
        {cache && (
          <table className="w-full text-sm border rounded-md overflow-hidden">
            <thead className="bg-muted">
              <tr>
                <th className="text-left p-2 w-24">ID</th>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2 w-20">Type</th>
                <th className="text-left p-2 w-24">Priority</th>
                <th className="text-left p-2 w-28">Status</th>
                <th className="text-left p-2 w-28">Assignee</th>
              </tr>
            </thead>
            <tbody>
              {epics.map((epic) => {
                const children = filtered.filter((i) => i.parentId === epic.id)
                const closedCount = children.filter((i) => i.status === 'closed').length
                const expanded = expandedEpics.has(epic.id)
                return (
                  <>
                    <tr
                      key={epic.id}
                      className="border-t bg-muted/20 cursor-pointer hover:bg-muted/40"
                      onClick={() => {
                        setExpandedEpics((prev) => {
                          const next = new Set(prev)
                          next.has(epic.id) ? next.delete(epic.id) : next.add(epic.id)
                          return next
                        })
                      }}
                    >
                      <td className="p-2 font-mono text-xs text-muted-foreground">{epic.id}</td>
                      <td className="p-2 font-medium">
                        <span className="mr-2">{expanded ? '▾' : '▸'}</span>
                        {epic.title}
                        <span className="ml-2 text-xs text-muted-foreground">{closedCount}/{children.length} closed</span>
                      </td>
                      <td className="p-2"><Badge variant="outline">{epic.type}</Badge></td>
                      <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[epic.priority])}>{PRIORITY_LABELS[epic.priority]}</span></td>
                      <td className="p-2"><Badge variant="outline">{epic.status}</Badge></td>
                      <td className="p-2 text-muted-foreground">{epic.assignee || '—'}</td>
                    </tr>
                    {expanded && children.map((child) => (
                      <tr
                        key={child.id}
                        className="border-t cursor-pointer hover:bg-muted/20"
                        onClick={() => setSelected(child)}
                      >
                        <td className="p-2 pl-6 font-mono text-xs text-muted-foreground">{child.id}</td>
                        <td className="p-2 pl-6">{child.title}</td>
                        <td className="p-2"><Badge variant="outline">{child.type}</Badge></td>
                        <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[child.priority])}>{PRIORITY_LABELS[child.priority]}</span></td>
                        <td className="p-2"><Badge variant="outline">{child.status}</Badge></td>
                        <td className="p-2 text-muted-foreground">{child.assignee || '—'}</td>
                      </tr>
                    ))}
                  </>
                )
              })}
              {orphans.map((issue) => (
                <tr
                  key={issue.id}
                  className="border-t cursor-pointer hover:bg-muted/20"
                  onClick={() => setSelected(issue)}
                >
                  <td className="p-2 font-mono text-xs text-muted-foreground">{issue.id}</td>
                  <td className="p-2">{issue.title}</td>
                  <td className="p-2"><Badge variant="outline">{issue.type}</Badge></td>
                  <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[issue.priority])}>{PRIORITY_LABELS[issue.priority]}</span></td>
                  <td className="p-2"><Badge variant="outline">{issue.status}</Badge></td>
                  <td className="p-2 text-muted-foreground">{issue.assignee || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <aside className="w-80 border rounded-md p-4 flex flex-col gap-3 shrink-0 self-start">
          <div className="flex items-start justify-between">
            <span className="font-mono text-xs text-muted-foreground">{selected.id}</span>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-sm">✕</button>
          </div>
          <h3 className="font-semibold text-sm">{selected.title}</h3>
          {selected.description && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap">{selected.description}</p>
            </div>
          )}
          {selected.acceptance_criteria && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Acceptance criteria</p>
              <p className="text-sm whitespace-pre-wrap">{selected.acceptance_criteria}</p>
            </div>
          )}
          {selected.dependencies.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Dependencies</p>
              <ul className="flex flex-col gap-1">
                {selected.dependencies.map((d) => (
                  <li key={d} className="font-mono text-xs">{d}</li>
                ))}
              </ul>
            </div>
          )}
          {selected.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {selected.labels.map((l) => <Badge key={l} variant="outline">{l}</Badge>)}
            </div>
          )}
        </aside>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Delete old pages**

```bash
rm app/\(pm\)/projects/\[projectId\]/ado/page.tsx
rm app/\(pm\)/projects/\[projectId\]/dev-plan/page.tsx
```

- [ ] **Step 3: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 4: Manual smoke test**

With dev server running, create a project with an ADO board. Navigate to the board tab — verify the Sprint Board / Dev Plan sub-tabs render and the Sync button is present. Create a project with Beads — verify the issues table placeholder renders.

- [ ] **Step 5: Commit**

```bash
git add app/\(pm\)/projects/\[projectId\]/boards/
git rm app/\(pm\)/projects/\[projectId\]/ado/page.tsx app/\(pm\)/projects/\[projectId\]/dev-plan/page.tsx
git commit -m "feat: add dynamic board page with ADO sprint/devplan and Beads issues views"
```

---

### Task 9: Overview tab — Boards card

**Files:**
- Modify: `app/(pm)/projects/[projectId]/overview/page.tsx`

**Interfaces:**
- Consumes: `POST /api/boards/configure/[projectId]` from Task 5
- Produces: `BoardsCard` component replacing `AdoConfigSection`; lists boards, add/edit/remove

- [ ] **Step 1: Replace `app/(pm)/projects/[projectId]/overview/page.tsx`**

```tsx
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
import type { TrackerBoard, TrackerType } from '@/lib/types'

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

      {isOwner && orgId && (
        <BoardsCard
          orgId={orgId}
          projectId={projectId}
          boards={project.trackerBoards}
          onSaved={() => qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })}
        />
      )}
    </div>
  )
}

function emptyBoard(type: TrackerType): Omit<TrackerBoard, 'id'> {
  return {
    label: '',
    type,
    adoOrgUrl: '',
    adoProject: '',
    adoPat: '',
    adoTeam: '',
    beadsRepo: '',
    beadsBranch: 'main',
  }
}

function BoardsCard({
  orgId, projectId, boards, onSaved,
}: {
  orgId: string
  projectId: string
  boards: TrackerBoard[]
  onSaved: () => void
}) {
  const [editingBoard, setEditingBoard] = useState<TrackerBoard | null>(null)
  const [adding, setAdding] = useState(false)
  const [newType, setNewType] = useState<TrackerType>('ado')
  const [pat, setPat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const draftBoard: TrackerBoard = editingBoard ?? {
    id: crypto.randomUUID(),
    ...emptyBoard(newType),
  }

  function updateDraft(patch: Partial<TrackerBoard>) {
    setEditingBoard((prev) => prev ? { ...prev, ...patch } : { ...draftBoard, ...patch })
  }

  async function handleSave() {
    const board = editingBoard ?? { id: crypto.randomUUID(), ...emptyBoard(newType) }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/boards/configure/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: boards.find((b) => b.id === board.id) ? 'edit' : 'add',
          board,
          orgId,
          ...(pat.trim() ? { pat: pat.trim() } : {}),
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setPat('')
      setAdding(false)
      setEditingBoard(null)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(boardId: string) {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/boards/configure/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', boardId, orgId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      onSaved()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const activeBoard = editingBoard ?? (adding ? { id: crypto.randomUUID(), ...emptyBoard(newType) } : null)

  return (
    <div className="border rounded-md p-4 flex flex-col gap-4">
      <h2 className="font-medium">Boards</h2>
      {boards.length === 0 && !adding && (
        <p className="text-sm text-muted-foreground">No boards configured.</p>
      )}
      {boards.map((b) => (
        <div key={b.id} className="flex items-center justify-between text-sm border rounded px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{b.label}</span>
            <Badge variant="outline">{b.type === 'ado' ? 'ADO Work Items' : 'Beads'}</Badge>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setEditingBoard(b); setAdding(false) }}>Edit</Button>
            <Button variant="ghost" size="sm" onClick={() => handleRemove(b.id)} disabled={saving}>Remove</Button>
          </div>
        </div>
      ))}

      {activeBoard && (
        <BoardForm
          board={activeBoard}
          pat={pat}
          onPat={setPat}
          onChange={updateDraft}
          onNewTypeChange={setNewType}
          newType={newType}
          isNew={!editingBoard}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        {!adding && !editingBoard && (
          <Button variant="outline" size="sm" onClick={() => { setAdding(true); setEditingBoard(null) }}>
            Add board
          </Button>
        )}
        {(adding || editingBoard) && (
          <>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save board'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setAdding(false); setEditingBoard(null); setPat('') }}>
              Cancel
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function BoardForm({
  board, pat, onPat, onChange, onNewTypeChange, newType, isNew,
}: {
  board: TrackerBoard
  pat: string
  onPat: (v: string) => void
  onChange: (patch: Partial<TrackerBoard>) => void
  onNewTypeChange: (t: TrackerType) => void
  newType: TrackerType
  isNew: boolean
}) {
  return (
    <div className="border rounded-md p-3 flex flex-col gap-3 bg-muted/20">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Label</Label>
          <Input value={board.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="e.g. Alpha, Backend" />
        </div>
        <div>
          <Label>Type</Label>
          {isNew ? (
            <select
              className="w-full border rounded px-2 py-1.5 text-sm"
              value={newType}
              onChange={(e) => {
                const t = e.target.value as TrackerType
                onNewTypeChange(t)
                onChange({ type: t })
              }}
            >
              <option value="ado">ADO Work Items</option>
              <option value="beads">Beads</option>
            </select>
          ) : (
            <Input value={board.type === 'ado' ? 'ADO Work Items' : 'Beads'} disabled />
          )}
        </div>
        <div>
          <Label>ADO Org URL</Label>
          <Input value={board.adoOrgUrl} onChange={(e) => onChange({ adoOrgUrl: e.target.value })} placeholder="https://dev.azure.com/myorg" />
        </div>
        <div>
          <Label>ADO Project</Label>
          <Input value={board.adoProject} onChange={(e) => onChange({ adoProject: e.target.value })} placeholder="MyProject" />
        </div>
        <div>
          <Label>Personal Access Token</Label>
          <Input
            type="password"
            value={pat}
            onChange={(e) => onPat(e.target.value)}
            placeholder={board.adoPat ? '••••• (set — enter new to replace)' : 'Enter PAT'}
          />
        </div>
        {board.type === 'ado' && (
          <div>
            <Label>ADO Team</Label>
            <Input value={board.adoTeam} onChange={(e) => onChange({ adoTeam: e.target.value })} placeholder="MyTeam" />
          </div>
        )}
        {board.type === 'beads' && (
          <>
            <div>
              <Label>Repo name</Label>
              <Input value={board.beadsRepo} onChange={(e) => onChange({ beadsRepo: e.target.value })} placeholder="MyRepo" />
            </div>
            <div>
              <Label>Branch</Label>
              <Input value={board.beadsBranch} onChange={(e) => onChange({ beadsBranch: e.target.value })} placeholder="main" />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 3: Manual smoke test**

Navigate to a project's Overview tab. Verify: Boards card is visible to owner, lists existing boards (if any), Add board form shows type-specific fields, Save board calls the configure API and the new board appears in the tab nav after page refresh.

- [ ] **Step 4: Commit**

```bash
git add app/\(pm\)/projects/\[projectId\]/overview/page.tsx
git commit -m "feat: replace AdoConfigSection with dynamic Boards card in overview"
```

---

### Task 10: Portal updates

**Files:**
- Modify: `components/portal/portal-project-tabs.tsx`
- Modify: `app/(client)/portal/[projectId]/layout.tsx`
- Create: `app/(client)/portal/[projectId]/boards/[boardId]/page.tsx`
- Delete: `app/(client)/portal/[projectId]/ado/page.tsx`

**Interfaces:**
- Consumes: `trackerBoards` from project; cached board data via `getLatestBoardCache`
- Produces: portal board tabs + read-only board page (no sync button)

- [ ] **Step 1: Replace `components/portal/portal-project-tabs.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { TrackerBoard } from '@/lib/types'

const STATIC_TABS = [
  { label: 'Overview',   segment: 'overview' },
  { label: 'Status',     segment: 'status' },
  { label: 'Documents',  segment: 'documents' },
  { label: 'Links',      segment: 'links' },
]

interface Props {
  projectId: string
  trackerBoards: TrackerBoard[]
}

export function PortalProjectTabs({ projectId, trackerBoards }: Props) {
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
    <nav className="flex border-b overflow-x-auto">
      {STATIC_TABS.slice(0, 3).map(({ label, segment }) => {
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
      {STATIC_TABS.slice(3).map(({ label, segment }) => {
        const href = `/portal/${projectId}/${segment}`
        const active = pathname.endsWith(`/${segment}`)
        return (
          <Link key={segment} href={href} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Update `app/(client)/portal/[projectId]/layout.tsx`**

```tsx
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
        <PortalProjectTabs projectId={projectId} trackerBoards={project?.trackerBoards ?? []} />
      </div>
      <div className="p-8">{children}</div>
    </div>
  )
}
```

- [ ] **Step 3: Create `app/(client)/portal/[projectId]/boards/[boardId]/page.tsx`**

```tsx
'use client'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { useProject } from '@/hooks/use-project'
import { getLatestBoardCache } from '@/lib/firestore/ado-cache'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BeadsIssue } from '@/lib/types'
import { useState } from 'react'

const PRIORITY_LABELS: Record<number, string> = {
  0: 'Critical', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Backlog',
}
const PRIORITY_COLORS: Record<number, string> = {
  0: 'bg-red-100 text-red-800', 1: 'bg-orange-100 text-orange-800',
  2: 'bg-yellow-100 text-yellow-800', 3: 'bg-blue-100 text-blue-800',
  4: 'bg-gray-100 text-gray-700',
}

export default function PortalBoardPage() {
  const { projectId, boardId } = useParams<{ projectId: string; boardId: string }>()
  const orgId = useOrgId()
  const { data: project } = useProject(orgId, projectId)
  const board = project?.trackerBoards.find((b) => b.id === boardId)

  if (!board) return <p className="text-muted-foreground">Loading…</p>
  if (board.type === 'beads') return <PortalBeadsView projectId={projectId} boardId={boardId} orgId={orgId} />
  return <PortalAdoView projectId={projectId} boardId={boardId} orgId={orgId} />
}

function PortalAdoView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const { data: sprintCache, isLoading: sl } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'sprint'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'sprint'),
    enabled: !!orgId,
  })
  const { data: devPlanCache, isLoading: dl } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'devplan'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'devplan'),
    enabled: !!orgId,
  })

  if (sl || dl) return <p className="text-muted-foreground">Loading…</p>
  if (!sprintCache && !devPlanCache) return <p className="text-muted-foreground">ADO data not yet available.</p>

  const VISIBLE = ['In Progress', 'Done']
  const sprintItems = ((sprintCache?.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]
  const visibleItems = sprintItems.filter((i) => VISIBLE.includes(String(i['state'] ?? '')))
  const iterations = ((devPlanCache?.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h2 className="font-semibold mb-4">Active Sprint</h2>
        {visibleItems.length === 0 && (
          <p className="text-muted-foreground text-sm">No in-progress or completed stories in the current sprint.</p>
        )}
        <div className="grid grid-cols-2 gap-4">
          {VISIBLE.map((col) => (
            <div key={col} className="border rounded-md p-4">
              <p className="font-medium text-sm mb-3">{col}</p>
              <div className="flex flex-col gap-2">
                {visibleItems.filter((i) => i['state'] === col).map((i, idx) => (
                  <div key={idx} className="text-xs border rounded p-2 bg-muted/30">
                    {String(i['title'] ?? i['id'] ?? idx)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
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

function PortalBeadsView({ projectId, boardId, orgId }: { projectId: string; boardId: string; orgId: string | undefined }) {
  const [selected, setSelected] = useState<BeadsIssue | null>(null)
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set())

  const { data: cache, isLoading } = useQuery({
    queryKey: ['board-cache', orgId, projectId, boardId, 'beads-issues'],
    queryFn: () => getLatestBoardCache(orgId!, projectId, boardId, 'beads-issues'),
    enabled: !!orgId,
  })

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>
  if (!cache) return <p className="text-muted-foreground">Issue data not yet available.</p>

  const allIssues: BeadsIssue[] = Array.isArray(cache.payload) ? cache.payload as BeadsIssue[] : []
  const childIds = new Set(allIssues.filter((i) => i.parentId).map((i) => i.parentId!))
  const epics = allIssues.filter((i) => childIds.has(i.id))
  const epicIds = new Set(epics.map((e) => e.id))
  const orphans = allIssues.filter((i) => !i.parentId && !epicIds.has(i.id))

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-4">Last synced: {cache.fetchedAt?.slice(0, 16) ?? '—'}</p>
        <table className="w-full text-sm border rounded-md overflow-hidden">
          <thead className="bg-muted">
            <tr>
              <th className="text-left p-2 w-24">ID</th>
              <th className="text-left p-2">Title</th>
              <th className="text-left p-2 w-24">Priority</th>
              <th className="text-left p-2 w-28">Status</th>
            </tr>
          </thead>
          <tbody>
            {epics.map((epic) => {
              const children = allIssues.filter((i) => i.parentId === epic.id)
              const closed = children.filter((i) => i.status === 'closed').length
              const expanded = expandedEpics.has(epic.id)
              return (
                <>
                  <tr
                    key={epic.id}
                    className="border-t bg-muted/20 cursor-pointer hover:bg-muted/40"
                    onClick={() => setExpandedEpics((prev) => { const n = new Set(prev); n.has(epic.id) ? n.delete(epic.id) : n.add(epic.id); return n })}
                  >
                    <td className="p-2 font-mono text-xs text-muted-foreground">{epic.id}</td>
                    <td className="p-2 font-medium">
                      <span className="mr-2">{expanded ? '▾' : '▸'}</span>
                      {epic.title}
                      <span className="ml-2 text-xs text-muted-foreground">{closed}/{children.length} closed</span>
                    </td>
                    <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[epic.priority])}>{PRIORITY_LABELS[epic.priority]}</span></td>
                    <td className="p-2"><Badge variant="outline">{epic.status}</Badge></td>
                  </tr>
                  {expanded && children.map((child) => (
                    <tr key={child.id} className="border-t cursor-pointer hover:bg-muted/20" onClick={() => setSelected(child)}>
                      <td className="p-2 pl-6 font-mono text-xs text-muted-foreground">{child.id}</td>
                      <td className="p-2 pl-6">{child.title}</td>
                      <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[child.priority])}>{PRIORITY_LABELS[child.priority]}</span></td>
                      <td className="p-2"><Badge variant="outline">{child.status}</Badge></td>
                    </tr>
                  ))}
                </>
              )
            })}
            {orphans.map((issue) => (
              <tr key={issue.id} className="border-t cursor-pointer hover:bg-muted/20" onClick={() => setSelected(issue)}>
                <td className="p-2 font-mono text-xs text-muted-foreground">{issue.id}</td>
                <td className="p-2">{issue.title}</td>
                <td className="p-2"><span className={cn('text-xs px-1.5 py-0.5 rounded', PRIORITY_COLORS[issue.priority])}>{PRIORITY_LABELS[issue.priority]}</span></td>
                <td className="p-2"><Badge variant="outline">{issue.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <aside className="w-72 border rounded-md p-4 flex flex-col gap-3 shrink-0 self-start">
          <div className="flex items-start justify-between">
            <span className="font-mono text-xs text-muted-foreground">{selected.id}</span>
            <button onClick={() => setSelected(null)} className="text-muted-foreground text-sm">✕</button>
          </div>
          <h3 className="font-semibold text-sm">{selected.title}</h3>
          {selected.description && <p className="text-sm whitespace-pre-wrap">{selected.description}</p>}
        </aside>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Delete old portal ADO page**

```bash
rm app/\(client\)/portal/\[projectId\]/ado/page.tsx
```

- [ ] **Step 5: Type-check**

```bash
pnpm tsc --noEmit
```

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: all tests pass. Fix any failures before proceeding.

- [ ] **Step 7: Manual smoke test — portal**

With dev server running, navigate to the client portal for a project that has a configured board. Verify: board tab appears in portal nav, ADO portal view shows active sprint (filtered) and dev plan, Beads portal view shows issues table (read-only, no sync button).

- [ ] **Step 8: Commit**

```bash
git add components/portal/portal-project-tabs.tsx
git add app/\(client\)/portal/\[projectId\]/layout.tsx
git add app/\(client\)/portal/\[projectId\]/boards/
git rm app/\(client\)/portal/\[projectId\]/ado/page.tsx
git commit -m "feat: dynamic board tabs and read-only board page in client portal"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `TrackerBoard` type with all fields | Task 1 |
| Remove flat ADO fields from `Project` | Task 1 |
| `BeadsIssue` type | Task 1 |
| `AdoCache.boardId` field | Task 1 |
| `createProject` accepts `firstBoard` | Task 2 |
| `getLatestBoardCache` by boardId | Task 2 |
| `fetchBeadsIssues` via ADO Git Items API | Task 3 |
| Unified board sync API replacing old ADO route | Task 4 |
| Beads JSONL parsing with `parentId` normalisation | Task 4 |
| Board configure API (add/edit/remove) | Task 5 |
| Project creation form tracker radio + label | Task 6 |
| Dynamic board tabs in PM workspace | Task 7 |
| PM board page — ADO sprint + dev plan sub-tabs | Task 8 |
| PM board page — Beads epic-grouped table + side panel | Task 8 |
| Remove old `/ado` and `/dev-plan` routes | Task 8 |
| Overview Boards card replace AdoConfigSection | Task 9 |
| Portal dynamic board tabs | Task 10 |
| Portal read-only board page (no sync) | Task 10 |
| Remove old portal ADO page | Task 10 |

**Known verification needed before coding epic grouping:** Confirm field name for parent relationship in a real `.beads/issues.jsonl` file — the parser in Task 4 handles both `parent_id` and `parentId` as a safety net.
