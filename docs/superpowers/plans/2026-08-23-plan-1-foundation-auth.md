# Orbital — Plan 1: Foundation, Auth & Onboarding

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js 15 project with Firebase, establish the full TypeScript type system, wire up Firestore security rules, implement Google sign-in, and build the org onboarding flow.

**Architecture:** Next.js 15 App Router on Vercel. Firebase Auth (Google provider) issues session cookies verified server-side by Next.js middleware, which gates the `(pm)` and `(client)` route groups before any page renders. Firestore security rules provide a second enforcement layer at the database level, scoping all reads and writes to org members with appropriate project roles.

**Tech Stack:** Next.js 15, TypeScript 5, Firebase v10 (client), firebase-admin v12 (server), Tailwind CSS, shadcn/ui, TanStack Query v5, Vitest, @testing-library/react, @firebase/rules-unit-testing

## Global Constraints

- Next.js 15.x with App Router — no Pages Router
- TypeScript strict mode (`"strict": true`)
- All Firestore documents carry `orgId` field
- Firebase Auth: Google provider only
- No org-level superuser — access is per-project only
- `members` map on each project: `{ [uid]: "owner" | "editor" | "viewer" }`
- `NEXT_PUBLIC_*` prefix required for all client-accessible env vars
- Node.js runtime on Vercel (not Edge) — required for `crypto` in ADO routes (Plan 4)
- shadcn/ui components via `npx shadcn@latest add` — do not hand-roll UI primitives

---

## File Map

```
orbital/
├── app/
│   ├── layout.tsx                          # Root layout, QueryClientProvider
│   ├── providers.tsx                       # TanStack Query client provider
│   ├── globals.css
│   ├── (auth)/
│   │   ├── login/page.tsx                  # Google sign-in page
│   │   └── layout.tsx                      # Centered auth shell
│   ├── onboarding/
│   │   └── page.tsx                        # Create or join org
│   ├── (pm)/
│   │   └── layout.tsx                      # PM workspace shell (stub — Plan 2)
│   └── (client)/
│       └── layout.tsx                      # Client portal shell (stub — Plan 3)
├── app/api/auth/
│   ├── session/route.ts                    # POST: exchange ID token for session cookie
│   └── signout/route.ts                    # POST: delete session cookie
├── lib/
│   ├── types.ts                            # All domain TypeScript types
│   ├── firebase/
│   │   ├── client.ts                       # Client SDK: auth, db, storage
│   │   └── admin.ts                        # Admin SDK: adminAuth, adminDb
│   └── firestore/
│       └── orgs.ts                         # createOrg, joinOrg, getUserOrg, orgExists
├── components/
│   └── auth/
│       └── google-sign-in-button.tsx       # Google OAuth trigger button
├── hooks/
│   └── use-auth.ts                         # onAuthStateChanged hook
├── middleware.ts                           # Route gating via session cookie
├── firestore.rules                         # Firestore security rules
├── .env.local.example                      # Env var template
└── vitest.config.ts                        # Vitest + jsdom config
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json` (via `create-next-app`)
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `.env.local.example`

**Interfaces:**
- Produces: runnable `npm run dev`, passing `npm test`

- [ ] **Step 1: Scaffold Next.js 15 app**

```bash
npx create-next-app@latest orbital \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd orbital
```

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install firebase firebase-admin \
  @tanstack/react-query \
  lucide-react \
  clsx tailwind-merge
```

- [ ] **Step 3: Install dev dependencies**

```bash
npm install -D vitest @vitejs/plugin-react \
  @testing-library/react @testing-library/jest-dom \
  @firebase/rules-unit-testing \
  jsdom
```

- [ ] **Step 4: Install shadcn/ui**

```bash
npx shadcn@latest init
# Choose: Default style, Zinc base color, CSS variables: yes
npx shadcn@latest add button input label badge card dialog table
```

- [ ] **Step 5: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

- [ ] **Step 6: Create `vitest.setup.ts`**

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 7: Add test scripts to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:rules": "vitest run lib/firestore/rules.test.ts"
```

- [ ] **Step 8: Create `.env.local.example`**

```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

SESSION_COOKIE_NAME=__session
```

- [ ] **Step 9: Run tests to confirm zero-error baseline**

```bash
npm test
```
Expected: 0 tests collected, no errors.

- [ ] **Step 10: Commit**

```bash
git add .
git commit -m "chore: scaffold Next.js 15 app with Firebase, shadcn, Vitest"
```

---

### Task 2: TypeScript Domain Types

**Files:**
- Create: `lib/types.ts`
- Create: `lib/types.test.ts`

**Interfaces:**
- Produces: all domain types imported as `import type { Project, Risk, ... } from '@/lib/types'`

- [ ] **Step 1: Write failing type tests**

```typescript
// lib/types.test.ts
import type {
  Org, OrgUser, Project, AccessLevel,
  Resource, ProjectFile, OnboardItem,
  Risk, Issue, ClientAction, Stakeholder,
  HelpfulLink, RoadmapItem, AdoCache, StatusSnapshot,
  StatusLevel, Severity,
} from '@/lib/types'

test('AccessLevel values compile', () => {
  const level: AccessLevel = 'owner'
  expect(level).toBe('owner')
})

test('StatusLevel values compile', () => {
  const status: StatusLevel = 'on_track'
  expect(status).toBe('on_track')
})

test('Project members map accepts uid keys with AccessLevel values', () => {
  const members: Project['members'] = { uid123: 'editor', uid456: 'viewer' }
  expect(members['uid123']).toBe('editor')
})

test('StatusHeader uses StatusLevel for all three fields', () => {
  const header: Project['statusHeader'] = {
    scheduleStatus: 'on_track',
    budgetStatus: 'at_risk',
    scopeStatus: 'off_track',
  }
  expect(header.budgetStatus).toBe('at_risk')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test lib/types.test.ts
```
Expected: FAIL — types not defined.

- [ ] **Step 3: Create `lib/types.ts`**

```typescript
export type AccessLevel = 'owner' | 'editor' | 'viewer'
export type StatusLevel = 'on_track' | 'at_risk' | 'off_track'
export type Severity = 'low' | 'medium' | 'high'
export type OpenResolved = 'open' | 'resolved'

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
  adoOrgUrl: string
  adoProject: string
  adoTeam: string
  adoPat: string          // AES-256-GCM encrypted at rest
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
  type: 'backlog' | 'sprint' | 'devplan'
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

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test lib/types.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/types.test.ts
git commit -m "feat: add TypeScript domain types"
```

---

### Task 3: Firebase SDK Setup

**Files:**
- Create: `lib/firebase/client.ts`
- Create: `lib/firebase/admin.ts`
- Create: `lib/firebase/client.test.ts`

**Interfaces:**
- Produces: `auth`, `db`, `storage` (client SDK); `adminAuth`, `adminDb` (server SDK)
- Consumed by: all Firestore helpers, API routes, auth hooks

- [ ] **Step 1: Write failing test**

```typescript
// lib/firebase/client.test.ts
import { vi } from 'vitest'

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}))
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ type: 'auth' })) }))
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(() => ({ type: 'db' })) }))
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(() => ({ type: 'storage' })) }))

test('exports auth, db, and storage', async () => {
  const { auth, db, storage } = await import('./client')
  expect(auth).toBeDefined()
  expect(db).toBeDefined()
  expect(storage).toBeDefined()
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test lib/firebase/client.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/firebase/client.ts`**

```typescript
import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
}

const app = getApps().length === 0 ? initializeApp(config) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
```

- [ ] **Step 4: Create `lib/firebase/admin.ts`**

```typescript
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export const adminAuth = getAuth()
export const adminDb = getFirestore()
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test lib/firebase/client.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/firebase/
git commit -m "feat: wire up Firebase client and admin SDK"
```

---

### Task 4: Firestore Security Rules

**Files:**
- Create: `firestore.rules`
- Create: `lib/firestore/rules.test.ts`

**Interfaces:**
- Produces: `firestore.rules` — deployed alongside the app, enforces org isolation and project role access

**Note:** These tests require the Firebase emulator. Install the Firebase CLI (`npm install -g firebase-tools`) and run `firebase init emulators` (select Firestore), then start with `firebase emulators:start --only firestore` before running `npm run test:rules`.

- [ ] **Step 1: Write failing rules tests**

```typescript
// lib/firestore/rules.test.ts
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'orbital-test',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterEach(() => testEnv.clearFirestore())
afterAll(() => testEnv.cleanup())

const ORG = 'org1'
const PROJECT = 'proj1'
const OWNER_UID = 'user-owner'
const EDITOR_UID = 'user-editor'
const VIEWER_UID = 'user-viewer'
const OUTSIDER_UID = 'user-outsider'

async function seedProject() {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, `orgs/${ORG}`), { name: 'Test Org' })
    await setDoc(doc(db, `orgs/${ORG}/users/${OWNER_UID}`), { email: 'owner@test.com' })
    await setDoc(doc(db, `orgs/${ORG}/users/${EDITOR_UID}`), { email: 'editor@test.com' })
    await setDoc(doc(db, `orgs/${ORG}/users/${VIEWER_UID}`), { email: 'viewer@test.com' })
    await setDoc(doc(db, `orgs/${ORG}/projects/${PROJECT}`), {
      orgId: ORG,
      name: 'Test Project',
      members: {
        [OWNER_UID]: 'owner',
        [EDITOR_UID]: 'editor',
        [VIEWER_UID]: 'viewer',
      },
    })
  })
}

test('unauthenticated user cannot read projects', async () => {
  await seedProject()
  const ctx = testEnv.unauthenticatedContext()
  await assertFails(getDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
})

test('owner can read their project', async () => {
  await seedProject()
  const ctx = testEnv.authenticatedContext(OWNER_UID)
  await assertSucceeds(getDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
})

test('editor can read project and write subcollections', async () => {
  await seedProject()
  const ctx = testEnv.authenticatedContext(EDITOR_UID)
  await assertSucceeds(getDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
  await assertSucceeds(
    setDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}/risks/r1`), {
      orgId: ORG, title: 'Risk', owner: 'Ed', severity: 'low',
      description: '', status: 'open', createdAt: '', updatedAt: '',
    })
  )
})

test('viewer cannot write to project subcollections', async () => {
  await seedProject()
  const ctx = testEnv.authenticatedContext(VIEWER_UID)
  await assertFails(
    setDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}/risks/r1`), {
      orgId: ORG, title: 'Risk',
    })
  )
})

test('outsider cannot read project', async () => {
  await seedProject()
  const ctx = testEnv.authenticatedContext(OUTSIDER_UID)
  await assertFails(getDoc(doc(ctx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
})

test('editor cannot delete project — only owner can', async () => {
  await seedProject()
  const editorCtx = testEnv.authenticatedContext(EDITOR_UID)
  await assertFails(deleteDoc(doc(editorCtx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
  const ownerCtx = testEnv.authenticatedContext(OWNER_UID)
  await assertSucceeds(deleteDoc(doc(ownerCtx.firestore(), `orgs/${ORG}/projects/${PROJECT}`)))
})

test('org member cannot read a different org', async () => {
  await seedProject()
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'orgs/other-org/projects/proj2'), {
      orgId: 'other-org', name: 'Other', members: {},
    })
  })
  const ctx = testEnv.authenticatedContext(OWNER_UID)
  await assertFails(getDoc(doc(ctx.firestore(), 'orgs/other-org/projects/proj2')))
})
```

- [ ] **Step 2: Start emulator and run tests to verify they fail**

```bash
firebase emulators:start --only firestore &
npm run test:rules
```
Expected: FAIL — `firestore.rules` not found.

- [ ] **Step 3: Create `firestore.rules`**

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isMember(orgId, projectId) {
      return isSignedIn() &&
        get(/databases/$(database)/documents/orgs/$(orgId)/projects/$(projectId))
          .data.members[request.auth.uid] != null;
    }

    function hasRole(orgId, projectId, role) {
      return isSignedIn() &&
        get(/databases/$(database)/documents/orgs/$(orgId)/projects/$(projectId))
          .data.members[request.auth.uid] == role;
    }

    function isOwnerOrEditor(orgId, projectId) {
      let role = get(/databases/$(database)/documents/orgs/$(orgId)/projects/$(projectId))
        .data.members[request.auth.uid];
      return isSignedIn() && (role == 'owner' || role == 'editor');
    }

    function isOrgMember(orgId) {
      return isSignedIn() &&
        exists(/databases/$(database)/documents/orgs/$(orgId)/users/$(request.auth.uid));
    }

    match /orgs/{orgId} {
      allow read: if isOrgMember(orgId);
      allow create: if isSignedIn();
      allow update, delete: if false;

      match /users/{uid} {
        allow read: if isOrgMember(orgId);
        allow create: if isSignedIn() && request.auth.uid == uid;
        allow update, delete: if false;
      }

      match /projects/{projectId} {
        allow read: if isMember(orgId, projectId);
        allow create: if isOrgMember(orgId) &&
                         request.resource.data.orgId == orgId;
        allow update: if isOwnerOrEditor(orgId, projectId) &&
                         request.resource.data.orgId == resource.data.orgId;
        allow delete: if hasRole(orgId, projectId, 'owner');

        match /{subcollection}/{docId} {
          allow read: if isMember(orgId, projectId);
          allow create, update: if isOwnerOrEditor(orgId, projectId);
          allow delete: if isOwnerOrEditor(orgId, projectId);
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:rules
```
Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add firestore.rules lib/firestore/rules.test.ts
git commit -m "feat: add Firestore security rules with org isolation and role-based access"
```

---

### Task 5: Middleware (Route Group Gating)

**Files:**
- Create: `middleware.ts`
- Create: `middleware.test.ts`

**Interfaces:**
- Consumes: `adminAuth` from `@/lib/firebase/admin`, `SESSION_COOKIE_NAME` env var
- Produces: protected routing — unauthenticated requests to `/dashboard` or `/portal` redirect to `/login`

- [ ] **Step 1: Write failing middleware tests**

```typescript
// middleware.test.ts
import { vi, describe, test, expect } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifySessionCookie: vi.fn().mockRejectedValue(new Error('invalid')),
  })),
}))
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => ['app']),
  cert: vi.fn(),
}))
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
}))

function makeRequest(path: string, cookie?: string) {
  const url = `http://localhost:3000${path}`
  const headers = new Headers()
  if (cookie) headers.set('cookie', `__session=${cookie}`)
  return new NextRequest(url, { headers })
}

describe('middleware', () => {
  test('redirects unauthenticated user from /dashboard to /login', async () => {
    const { middleware } = await import('./middleware')
    const res = await middleware(makeRequest('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  test('redirects request with invalid cookie from /portal to /login', async () => {
    const { middleware } = await import('./middleware')
    const res = await middleware(makeRequest('/portal', 'bad-cookie'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  test('allows unauthenticated access to /login', async () => {
    const { middleware } = await import('./middleware')
    const res = await middleware(makeRequest('/login'))
    expect(res.status).not.toBe(307)
  })

  test('allows unauthenticated access to /onboarding', async () => {
    const { middleware } = await import('./middleware')
    const res = await middleware(makeRequest('/onboarding'))
    expect(res.status).not.toBe(307)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test middleware.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `middleware.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase/admin'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

const PUBLIC_PATHS = ['/login', '/onboarding', '/api/auth']

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (isPublic(pathname)) return NextResponse.next()

  const sessionCookie = req.cookies.get(COOKIE)?.value

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true)
    const res = NextResponse.next()
    res.headers.set('x-uid', decoded.uid)
    return res
  } catch {
    const res = NextResponse.redirect(new URL('/login', req.url))
    res.cookies.delete(COOKIE)
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test middleware.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add middleware.ts middleware.test.ts
git commit -m "feat: add Next.js middleware to gate pm and client route groups"
```

---

### Task 6: Google Sign-In Flow

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/(auth)/login/page.tsx`
- Create: `app/layout.tsx`
- Create: `app/providers.tsx`
- Create: `components/auth/google-sign-in-button.tsx`
- Create: `components/auth/google-sign-in-button.test.tsx`
- Create: `app/api/auth/session/route.ts`
- Create: `app/api/auth/signout/route.ts`
- Create: `hooks/use-auth.ts`

**Interfaces:**
- Consumes: `auth` from `@/lib/firebase/client`, `adminAuth` from `@/lib/firebase/admin`
- Produces: httpOnly session cookie on sign-in; `useAuth(): { user: User | null, loading: boolean }`

- [ ] **Step 1: Write failing component test**

```typescript
// components/auth/google-sign-in-button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(() => ({})),
  signInWithPopup: vi.fn().mockResolvedValue({
    user: { getIdToken: vi.fn().mockResolvedValue('token-123') },
  }),
  getAuth: vi.fn(() => ({})),
}))
vi.mock('@/lib/firebase/client', () => ({ auth: {} }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ replace: vi.fn() })) }))

global.fetch = vi.fn().mockResolvedValue({ ok: true })

test('renders Sign in with Google button', async () => {
  const { GoogleSignInButton } = await import('./google-sign-in-button')
  render(<GoogleSignInButton />)
  expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
})

test('calls signInWithPopup and posts token on click', async () => {
  const { signInWithPopup } = await import('firebase/auth')
  const { GoogleSignInButton } = await import('./google-sign-in-button')
  render(<GoogleSignInButton />)
  fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
  await vi.waitFor(() => {
    expect(signInWithPopup).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test components/auth/google-sign-in-button.test.tsx
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `components/auth/google-sign-in-button.tsx`**

```typescript
'use client'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function GoogleSignInButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    setLoading(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken()

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      })

      if (!res.ok) throw new Error('Session creation failed')
      router.replace('/dashboard')
    } catch {
      setError('Sign-in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleSignIn} disabled={loading} className="w-full">
        {loading ? 'Signing in…' : 'Sign in with Google'}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: Create `app/api/auth/session/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase/admin'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
const FIVE_DAYS_MS = 60 * 60 * 24 * 5 * 1000

export async function POST(req: NextRequest) {
  const { idToken } = await req.json()
  if (!idToken) return NextResponse.json({ error: 'Missing token' }, { status: 400 })

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: FIVE_DAYS_MS,
    })
    const res = NextResponse.json({ status: 'ok' })
    res.cookies.set(COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: FIVE_DAYS_MS / 1000,
      path: '/',
    })
    return res
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
```

- [ ] **Step 5: Create `app/api/auth/signout/route.ts`**

```typescript
import { NextResponse } from 'next/server'

const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

export async function POST() {
  const res = NextResponse.json({ status: 'ok' })
  res.cookies.delete(COOKIE)
  return res
}
```

- [ ] **Step 6: Create `hooks/use-auth.ts`**

```typescript
'use client'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth } from '@/lib/firebase/client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
```

- [ ] **Step 7: Create `app/providers.tsx`**

```typescript
'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
```

- [ ] **Step 8: Create `app/layout.tsx`**

```typescript
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = { title: 'Orbital' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Create `app/(auth)/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      {children}
    </div>
  )
}
```

- [ ] **Step 10: Create `app/(auth)/login/page.tsx`**

```typescript
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function LoginPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Orbital</CardTitle>
        <CardDescription>Sign in with your Google account to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <GoogleSignInButton />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 11: Run tests to verify they pass**

```bash
npm test components/auth/google-sign-in-button.test.tsx
```
Expected: 2 tests PASS.

- [ ] **Step 12: Commit**

```bash
git add app/ components/auth/ hooks/use-auth.ts
git commit -m "feat: add Google sign-in, session cookie API routes, auth hook, and root layout"
```

---

### Task 7: Org Onboarding (Create or Join)

**Files:**
- Create: `lib/firestore/orgs.ts`
- Create: `lib/firestore/orgs.test.ts`
- Create: `app/onboarding/page.tsx`
- Create: `app/(pm)/layout.tsx` (stub)
- Create: `app/(client)/layout.tsx` (stub)

**Interfaces:**
- Consumes: `db` from `@/lib/firebase/client`, types `Org`, `OrgUser` from `@/lib/types`
- Produces:
  - `createOrg(name: string, uid: string, email: string, displayName: string): Promise<string>` — returns `orgId`
  - `joinOrg(orgId: string, uid: string, email: string, displayName: string): Promise<void>`
  - `orgExists(orgId: string): Promise<boolean>`

- [ ] **Step 1: Write failing tests**

```typescript
// lib/firestore/orgs.test.ts
import { vi } from 'vitest'

const mockAddDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockQuery = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  serverTimestamp: vi.fn(() => 'TIMESTAMP'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('createOrg creates org doc, creates user doc, returns orgId', async () => {
  mockAddDoc.mockResolvedValue({ id: 'org-abc' })
  mockCollection.mockReturnValue('col-ref')
  mockDoc.mockReturnValue('doc-ref')
  mockSetDoc.mockResolvedValue(undefined)

  const { createOrg } = await import('./orgs')
  const orgId = await createOrg('FortyAU', 'uid1', 'b@test.com', 'Bryce')

  expect(orgId).toBe('org-abc')
  expect(mockAddDoc).toHaveBeenCalledOnce()
  expect(mockSetDoc).toHaveBeenCalledOnce()
})

test('joinOrg writes user doc into existing org', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockSetDoc.mockResolvedValue(undefined)

  const { joinOrg } = await import('./orgs')
  await joinOrg('org-xyz', 'uid2', 'm@test.com', 'Mike')

  expect(mockSetDoc).toHaveBeenCalledWith(
    'doc-ref',
    expect.objectContaining({ uid: 'uid2', email: 'm@test.com' })
  )
})

test('orgExists returns false when org has no users', async () => {
  mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
  mockQuery.mockReturnValue('q-ref')
  mockCollection.mockReturnValue('col-ref')

  const { orgExists } = await import('./orgs')
  const result = await orgExists('no-such-org')
  expect(result).toBe(false)
})

test('orgExists returns true when org has users', async () => {
  mockGetDocs.mockResolvedValue({ empty: false, docs: [{}] })
  mockQuery.mockReturnValue('q-ref')
  mockCollection.mockReturnValue('col-ref')

  const { orgExists } = await import('./orgs')
  const result = await orgExists('existing-org')
  expect(result).toBe(true)
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test lib/firestore/orgs.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `lib/firestore/orgs.ts`**

```typescript
import {
  collection, doc, addDoc, setDoc, getDocs,
  query, serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/client'

export async function createOrg(
  name: string,
  uid: string,
  email: string,
  displayName: string,
): Promise<string> {
  const orgRef = await addDoc(collection(db, 'orgs'), {
    name,
    plan: 'free',
    createdAt: serverTimestamp(),
  })
  await setDoc(doc(db, `orgs/${orgRef.id}/users/${uid}`), {
    uid,
    email,
    displayName,
    createdAt: serverTimestamp(),
  })
  return orgRef.id
}

export async function joinOrg(
  orgId: string,
  uid: string,
  email: string,
  displayName: string,
): Promise<void> {
  await setDoc(doc(db, `orgs/${orgId}/users/${uid}`), {
    uid,
    email,
    displayName,
    createdAt: serverTimestamp(),
  })
}

export async function orgExists(orgId: string): Promise<boolean> {
  const snap = await getDocs(query(collection(db, `orgs/${orgId}/users`)))
  return !snap.empty
}
```

- [ ] **Step 4: Create `app/onboarding/page.tsx`**

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/use-auth'
import { createOrg, joinOrg, orgExists } from '@/lib/firestore/orgs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'

export default function OnboardingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [mode, setMode] = useState<'create' | 'join' | null>(null)
  const [orgName, setOrgName] = useState('')
  const [orgId, setOrgId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!user || !orgName.trim()) return
    setLoading(true)
    setError(null)
    try {
      await createOrg(orgName.trim(), user.uid, user.email!, user.displayName ?? user.email!)
      router.replace('/dashboard')
    } catch {
      setError('Failed to create org. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!user || !orgId.trim()) return
    setLoading(true)
    setError(null)
    try {
      const exists = await orgExists(orgId.trim())
      if (!exists) { setError('Org not found.'); setLoading(false); return }
      await joinOrg(orgId.trim(), user.uid, user.email!, user.displayName ?? user.email!)
      router.replace('/dashboard')
    } catch {
      setError('Failed to join org. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Orbital</CardTitle>
          <CardDescription>Set up your workspace to get started.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!mode && (
            <>
              <Button onClick={() => setMode('create')}>Create a new org</Button>
              <Button variant="outline" onClick={() => setMode('join')}>
                Join an existing org
              </Button>
            </>
          )}

          {mode === 'create' && (
            <>
              <Label htmlFor="orgName">Org name</Label>
              <Input
                id="orgName"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. FortyAU"
              />
              <Button onClick={handleCreate} disabled={loading || !orgName.trim()}>
                {loading ? 'Creating…' : 'Create org'}
              </Button>
              <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
            </>
          )}

          {mode === 'join' && (
            <>
              <Label htmlFor="orgId">Org invite code</Label>
              <Input
                id="orgId"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Paste the org ID from a team member"
              />
              <Button onClick={handleJoin} disabled={loading || !orgId.trim()}>
                {loading ? 'Joining…' : 'Join org'}
              </Button>
              <Button variant="ghost" onClick={() => setMode(null)}>Back</Button>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 5: Create route group stub layouts**

```typescript
// app/(pm)/layout.tsx
export default function PmLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

```typescript
// app/(client)/layout.tsx
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm test lib/firestore/orgs.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 7: Run full test suite**

```bash
npm test
```
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add lib/firestore/orgs.ts lib/firestore/orgs.test.ts app/onboarding/ app/(pm)/ app/(client)/
git commit -m "feat: add org create/join onboarding flow and route group stubs"
```

---

## Self-Review

**Spec coverage:**

| Requirement | Task |
|---|---|
| Next.js 15 App Router on Vercel | Task 1 |
| TypeScript strict mode | Task 1 |
| All domain types (Project, Risk, Issue, etc.) | Task 2 |
| Firebase Auth — Google provider only | Task 6 |
| Session cookie (httpOnly) for server-side auth | Task 6 |
| Middleware gates `(pm)` and `(client)` routes | Task 5 |
| Firestore org isolation via `orgId` field | Task 4 (rules) |
| `members` map: `{ [uid]: owner/editor/viewer }` | Task 2 (types) + Task 4 (rules) |
| owner full control, editor read/write, viewer read-only | Task 4 (rules) |
| No org-level superuser | Task 4 (rules enforce no privileged org role) |
| Multi-tenant onboarding: create or join org | Task 7 |
| TanStack Query provider wired up | Task 6 |

**Placeholder scan:** No TBDs, TODOs, or incomplete steps found.

**Type consistency:** `AccessLevel`, `StatusLevel`, `Severity`, `OpenResolved` defined in Task 2. `members: Record<string, AccessLevel>` used consistently in types and rules tests. `createOrg` / `joinOrg` / `orgExists` signatures defined in Task 7 and match usage in `onboarding/page.tsx`.
