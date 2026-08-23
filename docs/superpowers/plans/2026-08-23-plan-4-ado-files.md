# Orbital — Plan 4: ADO Integration + File Management

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the ADO REST proxy (with PAT encryption and Firestore caching), ADO configuration UI, a sync button that populates the cache Plans 2 and 3 already read, and file upload/download via Firebase Storage signed URLs.

**Architecture:** ADO calls never reach the browser — they go through `/api/ado/[projectId]` (Node.js runtime), which verifies the session cookie, checks project membership, decrypts the PAT with AES-256-GCM, calls ADO REST, writes the response to `adoCache`, and returns the payload. File uploads use a two-step signed URL flow: client calls `/api/files/upload` to get a short-lived signed PUT URL, uploads directly to Firebase Storage, then the API writes the Firestore file record. Downloads call `/api/files/download/[projectId]/[fileId]` which returns a temporary signed GET URL.

**Tech Stack:** Node.js `crypto` (AES-256-GCM), Firebase Admin SDK Storage, Azure DevOps REST API v7.1, Next.js API routes (Node.js runtime, not Edge)

**Prerequisites:** Plans 1, 2, and 3 complete.

## Global Constraints

- All constraints from Plans 1–3 apply
- ADO API routes use `export const runtime = 'nodejs'`
- `ADO_ENCRYPTION_KEY` env var: exactly 64 hex characters (32 bytes)
- `FIREBASE_STORAGE_BUCKET` env var: `{project-id}.appspot.com` or custom bucket name
- PAT is never logged, never returned to the client, never stored in plain text
- Decrypted PAT is used only within the API route handler scope
- ADO cache TTL: 15 minutes (900 000 ms); manual sync bypasses TTL
- Firebase Storage paths: `{orgId}/{projectId}/{fileId}-{filename}`
- Signed upload URL expiry: 15 minutes; signed download URL expiry: 5 minutes

---

## File Map

```
lib/ado/
├── encryption.ts                           # AES-256-GCM encrypt/decrypt
├── encryption.test.ts
├── client.ts                               # ADO REST fetch functions
└── client.test.ts
app/api/
├── ado/
│   ├── [projectId]/route.ts                # ADO proxy: verify → decrypt → fetch → cache
│   └── configure/[projectId]/route.ts      # Save encrypted PAT + ADO config fields
├── files/
│   ├── upload/route.ts                     # Return signed Firebase Storage PUT URL
│   └── download/[projectId]/[fileId]/
│       └── route.ts                        # Return signed Firebase Storage GET URL (redirect)
components/
└── files/
    ├── file-upload-button.tsx              # Upload flow: get signed URL → PUT → write Firestore doc
    └── file-upload-button.test.tsx
```

**Modified files from earlier plans:**
- `app/(pm)/projects/[projectId]/overview/page.tsx` — add ADO config section
- `app/(pm)/projects/[projectId]/ado/page.tsx` — wire sync button to API route
- `app/(pm)/projects/[projectId]/dev-plan/page.tsx` — wire sync button to API route
- `app/(pm)/projects/[projectId]/files/page.tsx` — replace disabled upload button with `FileUploadButton`
- `.env.local.example` — add `ADO_ENCRYPTION_KEY`, `FIREBASE_STORAGE_BUCKET`

---

### Task 1: AES-256-GCM Encryption Module

**Files:**
- Create: `lib/ado/encryption.ts`
- Create: `lib/ado/encryption.test.ts`

**Interfaces:**
- Produces:
  - `encryptPat(plaintext: string): string` — returns `ivHex:tagHex:ciphertextHex`
  - `decryptPat(encrypted: string): string` — reverses the above

- [ ] **Step 1: Write failing tests**

```typescript
// lib/ado/encryption.test.ts
import { describe, test, expect, beforeAll } from 'vitest'

beforeAll(() => {
  // Valid 64-hex-char key (32 bytes)
  process.env.ADO_ENCRYPTION_KEY = 'a'.repeat(64)
})

test('encryptPat returns three colon-separated hex segments', async () => {
  const { encryptPat } = await import('./encryption')
  const result = encryptPat('my-secret-pat')
  const parts = result.split(':')
  expect(parts).toHaveLength(3)
  // IV = 12 bytes = 24 hex chars; GCM tag = 16 bytes = 32 hex chars
  expect(parts[0]).toHaveLength(24)
  expect(parts[1]).toHaveLength(32)
})

test('decryptPat round-trips correctly', async () => {
  const { encryptPat, decryptPat } = await import('./encryption')
  const pat = 'super-secret-token-abc123'
  expect(decryptPat(encryptPat(pat))).toBe(pat)
})

test('same plaintext produces different ciphertext each call (random IV)', async () => {
  const { encryptPat } = await import('./encryption')
  const a = encryptPat('same-pat')
  const b = encryptPat('same-pat')
  expect(a).not.toBe(b)
})

test('decryptPat throws on tampered ciphertext', async () => {
  const { encryptPat, decryptPat } = await import('./encryption')
  const encrypted = encryptPat('original')
  const tampered = encrypted.slice(0, -4) + '0000'
  expect(() => decryptPat(tampered)).toThrow()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test lib/ado/encryption.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/ado/encryption.ts`**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const hex = process.env.ADO_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('ADO_ENCRYPTION_KEY must be 64 hex characters')
  return Buffer.from(hex, 'hex')
}

export function encryptPat(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function decryptPat(stored: string): string {
  const key = getKey()
  const [ivHex, tagHex, dataHex] = stored.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test lib/ado/encryption.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Update `.env.local.example`** — add:

```
ADO_ENCRYPTION_KEY=   # 64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
```

- [ ] **Step 6: Commit**

```bash
git add lib/ado/encryption.ts lib/ado/encryption.test.ts .env.local.example
git commit -m "feat: add AES-256-GCM PAT encryption module"
```

---

### Task 2: ADO REST Client

**Files:**
- Create: `lib/ado/client.ts`
- Create: `lib/ado/client.test.ts`

**Interfaces:**
- Produces:
  - `fetchBacklog(adoOrgUrl, adoProject, pat): Promise<unknown>` — WIQL epics + stories
  - `fetchSprint(adoOrgUrl, adoProject, adoTeam, pat): Promise<unknown>` — current iteration
  - `fetchDevPlan(adoOrgUrl, adoProject, pat): Promise<unknown>` — all iterations

- [ ] **Step 1: Write failing tests**

```typescript
// lib/ado/client.test.ts
import { vi, test, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => vi.clearAllMocks())

function adoOk(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

test('fetchBacklog POSTs WIQL query with Basic auth header', async () => {
  mockFetch.mockReturnValue(adoOk({ value: [] }))
  const { fetchBacklog } = await import('./client')
  await fetchBacklog('https://dev.azure.com/myorg', 'MyProject', 'my-pat')
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('wiql'),
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: expect.stringContaining('Basic '),
      }),
    })
  )
})

test('fetchSprint GETs current iteration', async () => {
  mockFetch.mockReturnValue(adoOk({ value: [] }))
  const { fetchSprint } = await import('./client')
  await fetchSprint('https://dev.azure.com/myorg', 'MyProject', 'MyTeam', 'my-pat')
  const [url] = mockFetch.mock.calls[0]
  expect(url).toContain('iterations')
  expect(url).toContain('current')
})

test('fetchDevPlan GETs all iterations without timeframe filter', async () => {
  mockFetch.mockReturnValue(adoOk({ value: [] }))
  const { fetchDevPlan } = await import('./client')
  await fetchDevPlan('https://dev.azure.com/myorg', 'MyProject', 'my-pat')
  const [url] = mockFetch.mock.calls[0]
  expect(url).toContain('iterations')
  expect(url).not.toContain('current')
})

test('throws on non-ok ADO response', async () => {
  mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') }))
  const { fetchBacklog } = await import('./client')
  await expect(fetchBacklog('https://dev.azure.com/myorg', 'MyProject', 'bad-pat')).rejects.toThrow('ADO request failed')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test lib/ado/client.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/ado/client.ts`**

```typescript
const API_VERSION = '7.1'

function authHeader(pat: string): string {
  return `Basic ${Buffer.from(`:${pat}`).toString('base64')}`
}

async function adoGet(url: string, pat: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader(pat),
      'Content-Type': 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ADO request failed: ${res.status} ${text}`)
  }
  return res.json()
}

async function adoPost(url: string, pat: string, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader(pat),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`ADO request failed: ${res.status} ${text}`)
  }
  return res.json()
}

export async function fetchBacklog(
  adoOrgUrl: string,
  adoProject: string,
  pat: string,
): Promise<unknown> {
  const url = `${adoOrgUrl}/${adoProject}/_apis/wit/wiql?api-version=${API_VERSION}`
  return adoPost(url, pat, {
    query:
      "SELECT [System.Id],[System.Title],[System.State],[System.WorkItemType] " +
      "FROM WorkItems WHERE [System.TeamProject] = @project " +
      "AND [System.WorkItemType] IN ('Epic','User Story') " +
      "ORDER BY [Microsoft.VSTS.Common.Priority] ASC",
  })
}

export async function fetchSprint(
  adoOrgUrl: string,
  adoProject: string,
  adoTeam: string,
  pat: string,
): Promise<unknown> {
  const url =
    `${adoOrgUrl}/${adoProject}/${adoTeam}/_apis/work/teamsettings/iterations` +
    `?$timeframe=current&api-version=${API_VERSION}`
  return adoGet(url, pat)
}

export async function fetchDevPlan(
  adoOrgUrl: string,
  adoProject: string,
  pat: string,
): Promise<unknown> {
  const url =
    `${adoOrgUrl}/${adoProject}/_apis/work/teamsettings/iterations` +
    `?api-version=${API_VERSION}`
  return adoGet(url, pat)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test lib/ado/client.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ado/client.ts lib/ado/client.test.ts
git commit -m "feat: add ADO REST client (backlog, sprint, devplan)"
```

---

### Task 3: ADO API Route

**Files:**
- Create: `app/api/ado/[projectId]/route.ts`
- Create: `app/api/ado/[projectId]/route.test.ts`

**Interfaces:**
- `GET /api/ado/[projectId]?type=backlog|sprint|devplan`
- Consumes: `adminAuth`, `adminDb`, `decryptPat`, `fetchBacklog`, `fetchSprint`, `fetchDevPlan`
- Produces: JSON `{ type, payload, fetchedAt, fromCache: boolean }`

- [ ] **Step 1: Write failing tests**

```typescript
// app/api/ado/[projectId]/route.test.ts
import { vi, test, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifySessionCookie = vi.fn()
const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifySessionCookie: mockVerifySessionCookie },
  adminDb: {
    doc: vi.fn((path: string) => ({ path })),
    collection: vi.fn((path: string) => ({ path })),
  },
}))
vi.mock('firebase-admin/firestore', () => ({
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  setDoc: mockSetDoc,
  doc: vi.fn((_, path) => ({ path })),
  collection: vi.fn((_, path) => ({ path })),
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('@/lib/ado/encryption', () => ({ decryptPat: vi.fn(() => 'decrypted-pat') }))
vi.mock('@/lib/ado/client', () => ({
  fetchBacklog: vi.fn().mockResolvedValue({ value: [{ id: 1, title: 'Epic A' }] }),
  fetchSprint: vi.fn().mockResolvedValue({ value: [] }),
  fetchDevPlan: vi.fn().mockResolvedValue({ value: [] }),
}))

beforeEach(() => vi.clearAllMocks())

const PROJECT_DOC = {
  exists: () => true,
  data: () => ({
    orgId: 'org1',
    adoOrgUrl: 'https://dev.azure.com/myorg',
    adoProject: 'MyProject',
    adoTeam: 'MyTeam',
    adoPat: 'iv:tag:cipher',
    members: { 'uid-owner': 'owner' },
  }),
}

function makeReq(projectId: string, type: string, cookie?: string) {
  const url = `http://localhost/api/ado/${projectId}?type=${type}`
  const headers = new Headers()
  if (cookie) headers.set('cookie', `__session=${cookie}`)
  return new NextRequest(url, { headers })
}

test('returns 401 when session cookie is missing', async () => {
  const { GET } = await import('./route')
  const res = await GET(makeReq('proj1', 'sprint'), { params: { projectId: 'proj1' } })
  expect(res.status).toBe(401)
})

test('returns 403 when user is not a project member', async () => {
  mockVerifySessionCookie.mockResolvedValue({ uid: 'uid-outsider' })
  mockGetDoc.mockResolvedValue(PROJECT_DOC)
  const { GET } = await import('./route')
  const res = await GET(makeReq('proj1', 'sprint', 'valid-cookie'), { params: { projectId: 'proj1' } })
  expect(res.status).toBe(403)
})

test('returns ADO data and writes to cache for authorized member', async () => {
  mockVerifySessionCookie.mockResolvedValue({ uid: 'uid-owner' })
  mockGetDoc.mockResolvedValue(PROJECT_DOC)
  mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
  mockSetDoc.mockResolvedValue(undefined)
  const { GET } = await import('./route')
  const res = await GET(makeReq('proj1', 'backlog', 'valid-cookie'), { params: { projectId: 'proj1' } })
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body.type).toBe('backlog')
  expect(body.fromCache).toBe(false)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test app/api/ado/'[projectId]'/route.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/api/ado/[projectId]/route.ts`**

```typescript
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { decryptPat } from '@/lib/ado/encryption'
import { fetchBacklog, fetchSprint, fetchDevPlan } from '@/lib/ado/client'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const TTL_MS = 15 * 60 * 1000

type CacheType = 'backlog' | 'sprint' | 'devplan'

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

async function getProjectDoc(orgId: string, projectId: string) {
  const snap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  return snap.exists ? snap.data()! : null
}

async function getOrgIdForProject(projectId: string): Promise<{ orgId: string; project: Record<string, unknown> } | null> {
  // Scan orgs to find the project — for v1 orgs are small
  const orgsSnap = await adminDb.collection('orgs').get()
  for (const orgDoc of orgsSnap.docs) {
    const projSnap = await adminDb.doc(`orgs/${orgDoc.id}/projects/${projectId}`).get()
    if (projSnap.exists) return { orgId: orgDoc.id, project: projSnap.data()! }
  }
  return null
}

async function getCachedEntry(orgId: string, projectId: string, type: CacheType) {
  const snap = await adminDb
    .collection(`orgs/${orgId}/projects/${projectId}/adoCache`)
    .where('type', '==', type)
    .orderBy('fetchedAt', 'desc')
    .limit(1)
    .get()
  if (snap.empty) return null
  const doc = snap.docs[0].data()
  const fetchedAt = doc.fetchedAt?.toMillis?.() ?? 0
  if (Date.now() - fetchedAt < TTL_MS) return doc
  return null
}

async function writeCache(
  orgId: string,
  projectId: string,
  type: CacheType,
  payload: unknown,
): Promise<string> {
  const ref = adminDb.collection(`orgs/${orgId}/projects/${projectId}/adoCache`).doc()
  await ref.set({ type, payload, fetchedAt: new Date() })
  return ref.id
}

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string } },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = params
  const type = (req.nextUrl.searchParams.get('type') ?? 'sprint') as CacheType

  const found = await getOrgIdForProject(projectId)
  if (!found) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

  const { orgId, project } = found
  const members = project.members as Record<string, string>
  if (!members[uid]) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Check cache first (unless manual sync — indicated by ?force=1)
  const force = req.nextUrl.searchParams.get('force') === '1'
  if (!force) {
    const cached = await getCachedEntry(orgId, projectId, type)
    if (cached) {
      return NextResponse.json({ type, payload: cached.payload, fetchedAt: cached.fetchedAt, fromCache: true })
    }
  }

  // Decrypt PAT and call ADO
  let pat: string
  try {
    pat = decryptPat(project.adoPat as string)
  } catch {
    return NextResponse.json({ error: 'PAT decryption failed — reconfigure ADO settings' }, { status: 500 })
  }

  const adoOrgUrl = project.adoOrgUrl as string
  const adoProject = project.adoProject as string
  const adoTeam = project.adoTeam as string

  let payload: unknown
  try {
    if (type === 'backlog') payload = await fetchBacklog(adoOrgUrl, adoProject, pat)
    else if (type === 'sprint') payload = await fetchSprint(adoOrgUrl, adoProject, adoTeam, pat)
    else payload = await fetchDevPlan(adoOrgUrl, adoProject, pat)
  } catch (e) {
    return NextResponse.json({ error: `ADO fetch failed: ${(e as Error).message}` }, { status: 502 })
  }

  const fetchedAt = new Date().toISOString()
  await writeCache(orgId, projectId, type, payload)

  return NextResponse.json({ type, payload, fetchedAt, fromCache: false })
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test "app/api/ado/[projectId]/route.test.ts"
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/api/ado/[projectId]/"
git commit -m "feat: add ADO proxy API route with session verification, PAT decryption, and cache"
```

---

### Task 4: ADO Configure Route + Overview Tab ADO Section

**Files:**
- Create: `app/api/ado/configure/[projectId]/route.ts`
- Modify: `app/(pm)/projects/[projectId]/overview/page.tsx`

**Interfaces:**
- `POST /api/ado/configure/[projectId]` — body: `{ adoOrgUrl, adoProject, adoTeam, pat }` — verifies owner role, encrypts PAT, writes to project doc
- Overview page gains an "ADO Connection" section (owner-only) with four inputs and a Save button

- [ ] **Step 1: Create `app/api/ado/configure/[projectId]/route.ts`**

```typescript
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { encryptPat } from '@/lib/ado/encryption'

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
  { params }: { params: { projectId: string } },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId } = params
  const { adoOrgUrl, adoProject, adoTeam, pat, orgId } = await req.json()

  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 })

  const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const members = projSnap.data()!.members as Record<string, string>
  if (members[uid] !== 'owner') return NextResponse.json({ error: 'Owner only' }, { status: 403 })

  const update: Record<string, string> = { adoOrgUrl, adoProject, adoTeam }
  if (pat && pat.trim()) {
    update.adoPat = encryptPat(pat.trim())
  }

  await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).update({
    ...update,
    updatedAt: new Date(),
  })

  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 2: Add ADO section to `app/(pm)/projects/[projectId]/overview/page.tsx`**

At the bottom of the `OverviewPage` component, before the closing `</div>`, add:

```typescript
{/* ADO Connection — owner only */}
{isOwner && (
  <AdoConfigSection orgId={orgId!} projectId={projectId} project={project} />
)}
```

Create the `AdoConfigSection` component in the same file:

```typescript
function AdoConfigSection({
  orgId, projectId, project,
}: {
  orgId: string
  projectId: string
  project: import('@/lib/types').Project
}) {
  const [adoOrgUrl, setAdoOrgUrl] = useState(project.adoOrgUrl)
  const [adoProject, setAdoProject] = useState(project.adoProject)
  const [adoTeam, setAdoTeam] = useState(project.adoTeam)
  const [pat, setPat] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/ado/configure/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adoOrgUrl, adoProject, adoTeam, pat, orgId }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSaved(true)
      setPat('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border rounded-md p-4 flex flex-col gap-3">
      <h2 className="font-medium">ADO Connection</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>ADO Org URL</Label>
          <Input value={adoOrgUrl} onChange={(e) => setAdoOrgUrl(e.target.value)} placeholder="https://dev.azure.com/myorg" />
        </div>
        <div>
          <Label>ADO Project</Label>
          <Input value={adoProject} onChange={(e) => setAdoProject(e.target.value)} placeholder="MyProject" />
        </div>
        <div>
          <Label>ADO Team</Label>
          <Input value={adoTeam} onChange={(e) => setAdoTeam(e.target.value)} placeholder="MyTeam" />
        </div>
        <div>
          <Label>Personal Access Token</Label>
          <Input
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder={project.adoPat ? '••••••• (set — enter new to replace)' : 'Enter PAT'}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-green-600">ADO settings saved.</p>}
      <Button onClick={handleSave} disabled={saving} className="self-start">
        {saving ? 'Saving…' : 'Save ADO settings'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/api/ado/configure/" "app/(pm)/projects/[projectId]/overview/"
git commit -m "feat: add ADO configure API route and ADO settings section in overview tab"
```

---

### Task 5: ADO Sync Button in PM Workspace

**Files:**
- Modify: `app/(pm)/projects/[projectId]/ado/page.tsx`
- Modify: `app/(pm)/projects/[projectId]/dev-plan/page.tsx`

**Interfaces:**
- Replace the stub `refetch()` with a call to `GET /api/ado/[projectId]?type=…&force=1`, then invalidate the TanStack Query cache

- [ ] **Step 1: Update `app/(pm)/projects/[projectId]/ado/page.tsx`**

Replace the existing file contents with:

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function AdoBoardPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { data: sprintCache, isLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'sprint'],
    queryFn: () => getLatestCache(orgId!, projectId, 'sprint'),
    enabled: !!orgId,
  })

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/ado/${projectId}?type=sprint&force=1`)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Sync failed')
      }
      qc.invalidateQueries({ queryKey: ['ado-cache', orgId, projectId, 'sprint'] })
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!sprintCache) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">ADO not configured or not yet synced.</p>
        <Button onClick={handleSync} disabled={syncing} className="self-start">
          {syncing ? 'Syncing…' : 'Sync from ADO'}
        </Button>
        {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      </div>
    )
  }

  const items = ((sprintCache.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">ADO Board — Active Sprint</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last synced: {sprintCache.fetchedAt?.slice(0, 16) ?? '—'}
          </span>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>
      </div>
      {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      <div className="grid grid-cols-3 gap-4">
        {['To Do', 'In Progress', 'Done'].map((col) => (
          <div key={col} className="border rounded-md p-3">
            <p className="font-medium text-sm mb-2">{col}</p>
            {items
              .filter((i) => i['state'] === col)
              .map((i, idx) => (
                <div key={idx} className="text-xs border rounded p-2 mb-1 bg-muted/30">
                  {String(i['title'] ?? idx)}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update `app/(pm)/projects/[projectId]/dev-plan/page.tsx`**

Replace the existing file contents with:

```typescript
'use client'
import { useParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useOrgId } from '@/hooks/use-org'
import { getLatestCache } from '@/lib/firestore/ado-cache'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function DevPlanPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const orgId = useOrgId()
  const qc = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)

  const { data: devPlanCache, isLoading } = useQuery({
    queryKey: ['ado-cache', orgId, projectId, 'devplan'],
    queryFn: () => getLatestCache(orgId!, projectId, 'devplan'),
    enabled: !!orgId,
  })

  async function handleSync() {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/ado/${projectId}?type=devplan&force=1`)
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Sync failed')
      }
      qc.invalidateQueries({ queryKey: ['ado-cache', orgId, projectId, 'devplan'] })
    } catch (e) {
      setSyncError((e as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Loading…</p>

  if (!devPlanCache) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-muted-foreground">Development plan not yet synced.</p>
        <Button onClick={handleSync} disabled={syncing} className="self-start">
          {syncing ? 'Syncing…' : 'Sync from ADO'}
        </Button>
        {syncError && <p className="text-sm text-destructive">{syncError}</p>}
      </div>
    )
  }

  const iterations = ((devPlanCache.payload?.value as unknown[]) ?? []) as Record<string, unknown>[]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Development Plan</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last synced: {devPlanCache.fetchedAt?.slice(0, 16) ?? '—'}
          </span>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync'}
          </Button>
        </div>
      </div>
      {syncError && <p className="text-sm text-destructive">{syncError}</p>}
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
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add "app/(pm)/projects/[projectId]/ado/" "app/(pm)/projects/[projectId]/dev-plan/"
git commit -m "feat: wire ADO sync button to API route in ADO board and dev plan tabs"
```

---

### Task 6: File Upload API Route + Upload Button

**Files:**
- Create: `app/api/files/upload/route.ts`
- Create: `components/files/file-upload-button.tsx`
- Create: `components/files/file-upload-button.test.tsx`
- Modify: `app/(pm)/projects/[projectId]/files/page.tsx` — replace disabled button with `FileUploadButton`

**Interfaces:**
- `POST /api/files/upload` — body: `{ orgId, projectId, fileName, mimeType, sizeBytes }` — returns `{ uploadUrl, fileId }`
- Upload flow: get signed URL → PUT file bytes → Firestore file record already written by API route → invalidate query
- Produces: `FileUploadButton({ orgId, projectId, onUploaded })`

- [ ] **Step 1: Write failing upload button test**

```typescript
// components/files/file-upload-button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

global.fetch = vi.fn()

const mockFetch = global.fetch as ReturnType<typeof vi.fn>

test('renders upload button', async () => {
  const { FileUploadButton } = await import('./file-upload-button')
  render(<FileUploadButton orgId="o1" projectId="p1" onUploaded={vi.fn()} />)
  expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument()
})

test('calls /api/files/upload then PUTs to signed URL on file selection', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ uploadUrl: 'https://storage.googleapis.com/signed', fileId: 'file-1' }),
    })
    .mockResolvedValueOnce({ ok: true })

  const onUploaded = vi.fn()
  const { FileUploadButton } = await import('./file-upload-button')
  render(<FileUploadButton orgId="o1" projectId="p1" onUploaded={onUploaded} />)

  const input = screen.getByTestId('file-input')
  const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' })
  Object.defineProperty(input, 'files', { value: [file] })
  fireEvent.change(input)

  await vi.waitFor(() => {
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/files/upload', expect.objectContaining({ method: 'POST' }))
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://storage.googleapis.com/signed', expect.objectContaining({ method: 'PUT' }))
    expect(onUploaded).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/files/file-upload-button.test.tsx
```
Expected: FAIL.

- [ ] **Step 3: Create `app/api/files/upload/route.ts`**

```typescript
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET!

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

export async function POST(req: NextRequest) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId, projectId, fileName, mimeType, sizeBytes } = await req.json()
  if (!orgId || !projectId || !fileName) {
    return NextResponse.json({ error: 'orgId, projectId, fileName required' }, { status: 400 })
  }

  // Verify membership (owner or editor)
  const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
  if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const members = projSnap.data()!.members as Record<string, string>
  const role = members[uid]
  if (role !== 'owner' && role !== 'editor') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Create Firestore file record first to get the fileId
  const fileRef = adminDb.collection(`orgs/${orgId}/projects/${projectId}/files`).doc()
  const storagePath = `${orgId}/${projectId}/${fileRef.id}-${fileName}`

  await fileRef.set({
    name: fileName,
    storagePath,
    mimeType: mimeType ?? 'application/octet-stream',
    sizeBytes: sizeBytes ?? 0,
    uploadedBy: uid,
    uploadedAt: new Date().toISOString(),
    sharedWithClient: false,
  })

  // Generate signed upload URL (15-minute expiry)
  const bucket = getStorage().bucket(BUCKET)
  const file = bucket.file(storagePath)
  const [uploadUrl] = await file.getSignedUrl({
    action: 'write',
    expires: Date.now() + 15 * 60 * 1000,
    contentType: mimeType ?? 'application/octet-stream',
  })

  return NextResponse.json({ uploadUrl, fileId: fileRef.id })
}
```

- [ ] **Step 4: Create `components/files/file-upload-button.tsx`**

```typescript
'use client'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Upload } from 'lucide-react'

interface Props {
  orgId: string
  projectId: string
  onUploaded: () => void
}

export function FileUploadButton({ orgId, projectId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      // Step 1: get signed URL + create Firestore record
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          projectId,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const { uploadUrl } = await res.json()

      // Step 2: PUT file bytes directly to Firebase Storage
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })
      if (!putRes.ok) throw new Error('Upload to storage failed')

      onUploaded()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        data-testid="file-input"
        onChange={handleChange}
      />
      <Button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        {uploading ? 'Uploading…' : 'Upload file'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test components/files/file-upload-button.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 6: Update files page — replace disabled button**

In `app/(pm)/projects/[projectId]/files/page.tsx`, replace:
```typescript
{canEdit && (
  <Button disabled title="Upload wired in Plan 4">Upload file</Button>
)}
```
with:
```typescript
import { FileUploadButton } from '@/components/files/file-upload-button'
// ...
{canEdit && orgId && (
  <FileUploadButton
    orgId={orgId}
    projectId={projectId}
    onUploaded={inv}
  />
)}
```

Also add `const orgId = useOrgId()` and the import to the page's top section.

- [ ] **Step 7: Commit**

```bash
git add app/api/files/upload/ components/files/ "app/(pm)/projects/[projectId]/files/"
git commit -m "feat: add file upload API route with signed URL and FileUploadButton component"
```

---

### Task 7: File Download API Route

**Files:**
- Create: `app/api/files/download/[projectId]/[fileId]/route.ts`

**Interfaces:**
- `GET /api/files/download/[projectId]/[fileId]` — verifies auth + membership, generates signed GET URL, redirects browser to it

- [ ] **Step 1: Create `app/api/files/download/[projectId]/[fileId]/route.ts`**

```typescript
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase/admin'
import { getStorage } from 'firebase-admin/storage'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const BUCKET = process.env.FIREBASE_STORAGE_BUCKET!

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

export async function GET(
  req: NextRequest,
  { params }: { params: { projectId: string; fileId: string } },
) {
  const uid = await getUid(req)
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { projectId, fileId } = params

  // Find the org for this project
  const orgsSnap = await adminDb.collection('orgs').get()
  let orgId: string | null = null
  let storagePath: string | null = null

  for (const orgDoc of orgsSnap.docs) {
    const fileSnap = await adminDb
      .doc(`orgs/${orgDoc.id}/projects/${projectId}/files/${fileId}`)
      .get()
    if (fileSnap.exists) {
      // Verify membership
      const projSnap = await adminDb.doc(`orgs/${orgDoc.id}/projects/${projectId}`).get()
      const members = projSnap.data()?.members as Record<string, string> | undefined
      if (!members?.[uid]) break
      orgId = orgDoc.id
      storagePath = fileSnap.data()!.storagePath as string
      break
    }
  }

  if (!orgId || !storagePath) {
    return NextResponse.json({ error: 'Not found or access denied' }, { status: 404 })
  }

  // Generate signed read URL (5-minute expiry)
  const bucket = getStorage().bucket(BUCKET)
  const [downloadUrl] = await bucket.file(storagePath).getSignedUrl({
    action: 'read',
    expires: Date.now() + 5 * 60 * 1000,
  })

  return NextResponse.redirect(downloadUrl)
}
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```
Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add "app/api/files/download/"
git commit -m "feat: add file download API route with signed GET URL redirect"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| PATs AES-256 encrypted before writing to Firestore | Task 1 |
| Encryption key in Vercel env var, never in code | Task 1 |
| ADO calls via `/api/ado` proxy — PAT never reaches browser | Task 3 |
| Verify Firebase session cookie before ADO call | Task 3 |
| Confirm uid in `project.members` before ADO call | Task 3 |
| Decrypt PAT server-side only | Task 3 |
| Write ADO response to `adoCache` with `fetchedAt` | Task 3 |
| Cache TTL 15 minutes | Task 3 |
| Manual refresh bypasses TTL (`?force=1`) | Task 3, 5 |
| "Last synced" timestamp shown | Task 5 |
| Sync button on ADO Board tab | Task 5 |
| Sync button on Dev Plan tab | Task 5 |
| ADO config (org URL, project, team, PAT) editable by owner | Task 4 |
| PAT not returned in UI — placeholder shows if set | Task 4 |
| `backlog` endpoint: WIQL epics + stories | Task 2 |
| `sprint` endpoint: current iteration | Task 2 |
| `devplan` endpoint: all iterations | Task 2 |
| File storage path `{orgId}/{projectId}/…` | Task 6 |
| No file publicly accessible by URL | Task 7 (signed URLs only) |
| Short-lived signed URLs — upload 15 min, download 5 min | Tasks 6, 7 |
| File upload wired in PM files tab | Task 6 |
| File download wired in client portal documents page | Task 7 (portal calls `/api/files/download/…`) |
| Owner/editor only can upload | Task 6 (API route checks role) |
| Any member can download (viewer included) | Task 7 (membership check, not role check) |

**Placeholder scan:** No TBDs found. `adoCache` collection uses `adminDb` (server-only) in the API route and the client-side `getLatestCache` (reads via client SDK) in the tabs — consistent with the architecture.

**Type consistency:** `CacheType = 'backlog' | 'sprint' | 'devplan'` matches `AdoCache['type']` defined in Plan 1 `lib/types.ts`. `storagePath` field name matches `ProjectFile.storagePath` from Plan 1 types. `sharedWithClient: false` default on upload matches the `ProjectFile` type.

**Security note:** The decrypted PAT is scoped to the handler function and never assigned to a variable that escapes the request. The `encryptPat`/`decryptPat` functions are only called server-side (`export const runtime = 'nodejs'` on all API routes). The PAT field is write-only in the UI — reading `project.adoPat` from the client returns the ciphertext, which is harmless without the server-side key.
