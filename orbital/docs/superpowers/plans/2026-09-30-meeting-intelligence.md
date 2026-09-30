# Orbital Meeting Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI-powered document intelligence to Orbital so every uploaded file (transcript, PDF, markdown) is read by Claude, which drafts decisions, milestones, risks, and issues directly into the project.

**Architecture:** Extend `ProjectFile` with optional AI fields (`aiStatus`, `aiSummary`, `aiDrafts`). A server-side API route downloads files from Firebase Storage, extracts text, calls Claude Sonnet 4.6 for structured extraction, and writes drafts back to Firestore. The redesigned Context tab and Overview page surface this intelligence. No new Firestore collections — all AI data lives on the existing `files` subcollection.

**Tech Stack:** Next.js 16 (App Router, Node.js runtime), React 19, Firebase Admin SDK (server), Firebase client SDK (browser), Tailwind v4, Vitest, `@anthropic-ai/sdk`, `pdf-parse`.

## Global Constraints

- Branch: `feature/meeting-intelligence` — never commit to `main`
- Runtime: all API routes must have `export const runtime = 'nodejs'` at the top
- Auth: API routes use session cookie `process.env.SESSION_COOKIE_NAME ?? '__session'`; verify with `adminAuth.verifySessionCookie(cookie, true)`
- Firebase Storage access: use `getApp().options.credential!.getAccessToken()` + `fetch` to the Firebase Storage REST API (pattern from `app/api/files/download`)
- Claude model: `claude-sonnet-4-6` — no other model
- No Beads integration in this feature
- All new env vars: `ANTHROPIC_API_KEY` (server-only, no `NEXT_PUBLIC_` prefix)
- Run `npm test` after every task that adds or changes tests; fix failures before committing
- Commit after each task with `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

### Task 1: Extend ProjectFile type + add client-side updateFileAiDrafts

**Files:**
- Modify: `lib/types.ts` — add AI fields to `ProjectFile`
- Modify: `lib/firestore/files.ts` — add `updateFileAiDrafts`
- Create: `lib/firestore/files.test.ts`

**Interfaces:**
- Produces:
  - `ProjectFile` extended with `aiStatus?`, `aiSummary?`, `aiProcessedAt?`, `aiDrafts?`
  - `updateFileAiDrafts(orgId, projectId, fileId, aiDrafts): Promise<void>` — replaces the entire `aiDrafts` object on the file document

---

- [ ] **Step 1: Add AI fields to `ProjectFile` in `lib/types.ts`**

  Open `lib/types.ts`. Find the `ProjectFile` interface (currently has: `id`, `name`, `storagePath`, `mimeType`, `sizeBytes`, `uploadedBy`, `uploadedAt`, `sharedWithClient`). Add after `sharedWithClient`:

  ```ts
  aiStatus?: 'unprocessed' | 'processing' | 'ready' | 'error'
  aiSummary?: string
  aiProcessedAt?: string
  aiDrafts?: {
    decisions: Array<{
      question?: string
      background?: string
      outcome?: string
      priority?: 'low' | 'medium' | 'high'
      status?: 'open' | 'decided'
    }>
    milestones: Array<{
      name?: string
      description?: string
      status?: 'not_started' | 'in_progress' | 'completed' | 'blocked'
      endDate?: string
    }>
    risks: Array<{
      title?: string
      description?: string
      severity?: 'low' | 'medium' | 'high'
    }>
    issues: Array<{
      title?: string
      description?: string
      severity?: 'low' | 'medium' | 'high'
    }>
  }
  ```

- [ ] **Step 2: Add `updateFileAiDrafts` to `lib/firestore/files.ts`**

  The full updated file:

  ```ts
  import { listItems, updateItem, deleteItem } from './subcollection'
  import type { ProjectFile } from '@/lib/types'

  const path = (o: string, p: string) => `orgs/${o}/projects/${p}/files`
  export const listFiles = (o: string, p: string) => listItems<ProjectFile>(path(o, p))
  export const updateFileShared = (o: string, p: string, id: string, sharedWithClient: boolean) =>
    updateItem(path(o, p), id, { sharedWithClient })
  export const deleteFile = (o: string, p: string, id: string) => deleteItem(path(o, p), id)
  export const updateFileAiDrafts = (
    o: string,
    p: string,
    id: string,
    aiDrafts: ProjectFile['aiDrafts'],
  ) => updateItem(path(o, p), id, { aiDrafts })
  ```

- [ ] **Step 3: Write the test file `lib/firestore/files.test.ts`**

  ```ts
  import { vi } from 'vitest'

  const mockUpdateDoc = vi.fn()
  const mockCollection = vi.fn()
  const mockDoc = vi.fn()
  const mockGetDocs = vi.fn()
  const mockDeleteDoc = vi.fn()

  vi.mock('firebase/firestore', () => ({
    collection: mockCollection,
    doc: mockDoc,
    updateDoc: mockUpdateDoc,
    getDocs: mockGetDocs,
    deleteDoc: mockDeleteDoc,
    serverTimestamp: vi.fn(() => 'TS'),
  }))
  vi.mock('@/lib/firebase/client', () => ({ db: {} }))

  beforeEach(() => vi.clearAllMocks())

  test('updateFileAiDrafts calls updateDoc with aiDrafts payload', async () => {
    mockDoc.mockReturnValue('doc-ref')
    mockUpdateDoc.mockResolvedValue(undefined)
    const { updateFileAiDrafts } = await import('./files')
    const drafts = { decisions: [], milestones: [], risks: [], issues: [] }
    await updateFileAiDrafts('org1', 'proj1', 'file1', drafts)
    expect(mockUpdateDoc).toHaveBeenCalledWith(
      'doc-ref',
      expect.objectContaining({ aiDrafts: drafts }),
    )
  })

  test('listFiles maps docs with id', async () => {
    mockCollection.mockReturnValue('col-ref')
    mockGetDocs.mockResolvedValue({
      docs: [{ id: 'f1', data: () => ({ name: 'notes.txt', aiStatus: 'ready' }) }],
    })
    const { listFiles } = await import('./files')
    const result = await listFiles('org1', 'proj1')
    expect(result[0]).toEqual({ id: 'f1', name: 'notes.txt', aiStatus: 'ready' })
  })
  ```

- [ ] **Step 4: Run tests**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital && npm test -- lib/firestore/files.test.ts
  ```

  Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add lib/types.ts lib/firestore/files.ts lib/firestore/files.test.ts
  git commit -m "$(cat <<'EOF'
  feat: extend ProjectFile with AI fields and updateFileAiDrafts

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: Install AI and PDF dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

---

- [ ] **Step 1: Install dependencies**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital && npm install @anthropic-ai/sdk pdf-parse && npm install --save-dev @types/pdf-parse
  ```

- [ ] **Step 2: Verify installation**

  ```bash
  node -e "require('@anthropic-ai/sdk'); console.log('ok')"
  node -e "require('pdf-parse'); console.log('ok')"
  ```

  Expected: both print `ok`.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add package.json package-lock.json
  git commit -m "$(cat <<'EOF'
  chore: add @anthropic-ai/sdk and pdf-parse dependencies

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: AI extraction module

**Files:**
- Create: `lib/ai/extract.ts`
- Create: `lib/ai/extract.test.ts`

**Interfaces:**
- Produces: `extractIntelligence(text: string): Promise<ExtractionResult>`
- `ExtractionResult` type is exported from this file

---

- [ ] **Step 1: Write the failing test `lib/ai/extract.test.ts`**

  ```ts
  import { vi } from 'vitest'

  const mockCreate = vi.fn()

  vi.mock('@anthropic-ai/sdk', () => ({
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  }))

  test('extractIntelligence parses Claude JSON response', async () => {
    const payload = {
      summary: 'Team agreed to migrate to GraphQL by Q4.',
      decisions: [{ question: 'Use GraphQL?', background: 'REST is slow', priority: 'high', status: 'decided', outcome: 'Yes' }],
      milestones: [{ name: 'GraphQL migration', status: 'not_started', endDate: '2026-12-31' }],
      risks: [{ title: 'Migration risk', description: 'Breaking changes', severity: 'medium' }],
      issues: [],
    }
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify(payload) }],
    })
    const { extractIntelligence } = await import('./extract')
    const result = await extractIntelligence('some transcript text')
    expect(result.summary).toBe('Team agreed to migrate to GraphQL by Q4.')
    expect(result.decisions).toHaveLength(1)
    expect(result.decisions[0].question).toBe('Use GraphQL?')
    expect(result.milestones).toHaveLength(1)
    expect(result.risks).toHaveLength(1)
    expect(result.issues).toHaveLength(0)
  })

  test('extractIntelligence returns empty arrays on malformed JSON', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not json at all' }],
    })
    const { extractIntelligence } = await import('./extract')
    const result = await extractIntelligence('some text')
    expect(result.summary).toBe('')
    expect(result.decisions).toEqual([])
    expect(result.milestones).toEqual([])
    expect(result.risks).toEqual([])
    expect(result.issues).toEqual([])
  })
  ```

- [ ] **Step 2: Run test to confirm it fails**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital && npm test -- lib/ai/extract.test.ts
  ```

  Expected: FAIL — `lib/ai/extract.ts` does not exist.

- [ ] **Step 3: Implement `lib/ai/extract.ts`**

  ```ts
  import Anthropic from '@anthropic-ai/sdk'

  export interface ExtractionResult {
    summary: string
    decisions: Array<{
      question?: string
      background?: string
      outcome?: string
      priority?: 'low' | 'medium' | 'high'
      status?: 'open' | 'decided'
    }>
    milestones: Array<{
      name?: string
      description?: string
      status?: 'not_started' | 'in_progress' | 'completed' | 'blocked'
      endDate?: string
    }>
    risks: Array<{
      title?: string
      description?: string
      severity?: 'low' | 'medium' | 'high'
    }>
    issues: Array<{
      title?: string
      description?: string
      severity?: 'low' | 'medium' | 'high'
    }>
  }

  const EMPTY: ExtractionResult = {
    summary: '',
    decisions: [],
    milestones: [],
    risks: [],
    issues: [],
  }

  const SYSTEM = `You are an AI assistant that extracts structured project intelligence from documents.
  Extract ONLY items that are clearly evidenced in the document. Do not invent or pad.
  Return a single valid JSON object — no markdown fences, no extra text.`

  const USER_PROMPT = (text: string) => `Extract project intelligence from this document and return JSON with this exact shape:
  {
    "summary": "2-3 sentence summary of the document",
    "decisions": [{ "question": "string", "background": "string", "outcome": "string or empty string", "priority": "low|medium|high", "status": "open|decided" }],
    "milestones": [{ "name": "string", "description": "string", "status": "not_started|in_progress|completed|blocked", "endDate": "YYYY-MM-DD or empty string" }],
    "risks": [{ "title": "string", "description": "string", "severity": "low|medium|high" }],
    "issues": [{ "title": "string", "description": "string", "severity": "low|medium|high" }]
  }

  Document:
  ${text.slice(0, 180000)}`

  export async function extractIntelligence(text: string): Promise<ExtractionResult> {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    let raw = ''
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM,
        messages: [{ role: 'user', content: USER_PROMPT(text) }],
      })
      raw = msg.content.find((b) => b.type === 'text')?.text ?? ''
      return JSON.parse(raw) as ExtractionResult
    } catch {
      return EMPTY
    }
  }
  ```

- [ ] **Step 4: Run tests to confirm pass**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital && npm test -- lib/ai/extract.test.ts
  ```

  Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add lib/ai/extract.ts lib/ai/extract.test.ts
  git commit -m "$(cat <<'EOF'
  feat: add AI extraction module using Claude Sonnet 4.6

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: POST /api/files/process route

**Files:**
- Create: `app/api/files/process/route.ts`

**Interfaces:**
- Consumes:
  - `extractIntelligence(text): Promise<ExtractionResult>` from `lib/ai/extract.ts`
  - `adminAuth`, `adminDb` from `lib/firebase/admin.ts`
  - `getApp` from `firebase-admin/app`
  - `pdf-parse` for PDF text extraction
- Produces: `POST /api/files/process` — request body `{ orgId, projectId, fileId }`, response `{ fileId, aiStatus: 'ready' }`

---

- [ ] **Step 1: Create `app/api/files/process/route.ts`**

  ```ts
  export const runtime = 'nodejs'

  import { NextRequest, NextResponse } from 'next/server'
  import { adminAuth, adminDb } from '@/lib/firebase/admin'
  import { getApp } from 'firebase-admin/app'
  import pdfParse from 'pdf-parse'
  import { extractIntelligence } from '@/lib/ai/extract'

  const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'
  const BUCKET = process.env.FIREBASE_STORAGE_BUCKET!

  // PPTX excluded: binary format requires dedicated parser (future task)
  const PROCESSABLE = new Set([
    'text/plain',
    'text/markdown',
    'application/pdf',
  ])

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

  async function fileToText(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'application/pdf') {
      const data = await pdfParse(buffer)
      return data.text
    }
    return buffer.toString('utf-8')
  }

  export async function POST(req: NextRequest) {
    const uid = await getUid(req)
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { orgId, projectId, fileId } = await req.json()
    if (!orgId || !projectId || !fileId) {
      return NextResponse.json({ error: 'orgId, projectId, fileId required' }, { status: 400 })
    }

    const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
    if (!projSnap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const role = (projSnap.data()!.members as Record<string, string>)[uid]
    if (role !== 'owner' && role !== 'editor') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fileRef = adminDb.doc(`orgs/${orgId}/projects/${projectId}/files/${fileId}`)
    const fileSnap = await fileRef.get()
    if (!fileSnap.exists) return NextResponse.json({ error: 'File not found' }, { status: 404 })

    const fileData = fileSnap.data()!
    const { aiStatus, storagePath, mimeType } = fileData as {
      aiStatus?: string
      storagePath: string
      mimeType: string
    }

    if (aiStatus === 'processing' || aiStatus === 'ready') {
      return NextResponse.json({ fileId, aiStatus }, { status: 200 })
    }

    if (!PROCESSABLE.has(mimeType)) {
      return NextResponse.json({ error: 'File type not supported for AI processing' }, { status: 422 })
    }

    await fileRef.update({ aiStatus: 'processing' })

    try {
      const { access_token } = await getApp().options.credential!.getAccessToken()
      const dlRes = await fetch(
        `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encodeURIComponent(storagePath)}?alt=media`,
        { headers: { Authorization: `Bearer ${access_token}` } },
      )
      if (!dlRes.ok) throw new Error(`Storage fetch failed: ${dlRes.status}`)

      const buffer = Buffer.from(await dlRes.arrayBuffer())
      const text = await fileToText(buffer, mimeType)
      const result = await extractIntelligence(text)

      await fileRef.update({
        aiStatus: 'ready',
        aiSummary: result.summary,
        aiProcessedAt: new Date().toISOString(),
        aiDrafts: {
          decisions: result.decisions,
          milestones: result.milestones,
          risks: result.risks,
          issues: result.issues,
        },
      })

      return NextResponse.json({ fileId, aiStatus: 'ready' })
    } catch (err) {
      console.error('[process] error', err)
      await fileRef.update({ aiStatus: 'error' })
      return NextResponse.json({ error: 'Processing failed' }, { status: 500 })
    }
  }
  ```

- [ ] **Step 2: Add `ANTHROPIC_API_KEY` to your local environment**

  In `.env.local` (create if it doesn't exist):
  ```
  ANTHROPIC_API_KEY=sk-ant-...
  ```

  This file is gitignored. Never commit it.

- [ ] **Step 3: Manual smoke test**

  Start dev server (`npm run dev`), sign in, upload a `.txt` file with some project notes. Then in the browser console or a REST client, call:

  ```
  POST /api/files/process
  Content-Type: application/json
  { "orgId": "<your-org>", "projectId": "<your-project>", "fileId": "<the-file-id>" }
  ```

  Check Firestore — the file document should show `aiStatus: 'ready'` and a populated `aiDrafts` object.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add app/api/files/process/route.ts
  git commit -m "$(cat <<'EOF'
  feat: add POST /api/files/process AI extraction route

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: POST /api/files/query streaming route

**Files:**
- Create: `app/api/files/query/route.ts`

**Interfaces:**
- Consumes: `adminAuth`, `adminDb` from `lib/firebase/admin.ts`
- Produces: `POST /api/files/query` — streams plain text answer with a JSON footer line `CITATIONS:{"citations":[...]}` at the end

---

- [ ] **Step 1: Create `app/api/files/query/route.ts`**

  ```ts
  export const runtime = 'nodejs'

  import { NextRequest } from 'next/server'
  import { adminAuth, adminDb } from '@/lib/firebase/admin'
  import Anthropic from '@anthropic-ai/sdk'

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

  export async function POST(req: NextRequest) {
    const uid = await getUid(req)
    if (!uid) return new Response('Unauthorized', { status: 401 })

    const { orgId, projectId, question } = await req.json()
    if (!orgId || !projectId || !question) {
      return new Response('orgId, projectId, question required', { status: 400 })
    }

    const projSnap = await adminDb.doc(`orgs/${orgId}/projects/${projectId}`).get()
    if (!projSnap.exists) return new Response('Not found', { status: 404 })
    const members = projSnap.data()!.members as Record<string, string>
    if (!members[uid]) return new Response('Forbidden', { status: 403 })

    const filesSnap = await adminDb
      .collection(`orgs/${orgId}/projects/${projectId}/files`)
      .where('aiStatus', '==', 'ready')
      .get()

    const sources = filesSnap.docs.map((d) => ({
      fileId: d.id,
      fileName: d.data().name as string,
      summary: d.data().aiSummary as string,
    }))

    if (sources.length === 0) {
      return new Response(
        'No processed files found in this project. Upload and process some files first.',
        { headers: { 'Content-Type': 'text/plain' } },
      )
    }

    const context = sources
      .map((s) => `[${s.fileName}]: ${s.summary}`)
      .join('\n\n')

    const system = `You are Orbital, an AI project intelligence assistant. Answer questions about the project using only the provided document summaries. Be concise and specific. If the answer is not in the summaries, say so.`

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: [
        {
          role: 'user',
          content: `Document summaries:\n${context}\n\nQuestion: ${question}`,
        },
      ],
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
        const citations = sources.map((s) => ({ fileId: s.fileId, fileName: s.fileName }))
        controller.enqueue(encoder.encode(`\nCITATIONS:${JSON.stringify({ citations })}`))
        controller.close()
      },
    })

    return new Response(readable, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  ```

- [ ] **Step 2: Manual smoke test**

  With at least one processed file in a project, call:
  ```
  POST /api/files/query
  { "orgId": "...", "projectId": "...", "question": "What decisions were made?" }
  ```

  Expected: streaming text response followed by a `CITATIONS:{...}` line.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add app/api/files/query/route.ts
  git commit -m "$(cat <<'EOF'
  feat: add POST /api/files/query streaming Q&A route

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: Auto-trigger processing after upload

**Files:**
- Modify: `components/files/file-upload-button.tsx`

**Interfaces:**
- Consumes: `POST /api/files/upload` (returns `{ fileId }`) → `POST /api/files/process`
- Props: `FileUploadButton` props unchanged externally; `onUploaded` callback is still `() => void`

---

- [ ] **Step 1: Update `components/files/file-upload-button.tsx`**

  Replace the `handleChange` function body. The full component after change:

  ```ts
  'use client'
  import { useRef, useState } from 'react'
  import { Button } from '@/components/ui/button'
  import { Upload } from 'lucide-react'

  interface Props {
    orgId: string
    projectId: string
    onUploaded: () => void
  }

  const PROCESSABLE_TYPES = new Set([
    'text/plain',
    'text/markdown',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ])

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
        const body = new FormData()
        body.append('file', file)
        body.append('orgId', orgId)
        body.append('projectId', projectId)

        const res = await fetch('/api/files/upload', { method: 'POST', body })
        if (!res.ok) throw new Error((await res.json()).error)
        const { fileId } = await res.json()

        onUploaded()

        if (PROCESSABLE_TYPES.has(file.type)) {
          fetch('/api/files/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orgId, projectId, fileId }),
          }).catch(() => {})
        }
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

  Note: the process call is fire-and-forget (`.catch(() => {})`) because processing can take 10–30 seconds. The UI will poll via React Query and update when Firestore reflects `aiStatus: 'ready'`.

- [ ] **Step 2: Enable React Query polling on the files page**

  This is handled in Task 7 when we redesign the files page. The `listFiles` query will use `refetchInterval: 5000` when any file has `aiStatus: 'processing'`.

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add components/files/file-upload-button.tsx
  git commit -m "$(cat <<'EOF'
  feat: auto-trigger AI processing after file upload

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: Context tab — file states, file drawer, Accept/Edit/Dismiss

**Files:**
- Create: `components/files/file-row.tsx`
- Create: `components/files/file-drawer.tsx`
- Modify: `app/(pm)/projects/[projectId]/files/page.tsx`

**Interfaces:**
- Consumes:
  - `ProjectFile` (extended type from Task 1)
  - `updateFileAiDrafts(orgId, projectId, fileId, drafts): Promise<void>` from `lib/firestore/files.ts`
  - `addDecision`, `listDecisions` from `lib/firestore/decisions.ts`
  - `addMilestone` from `lib/firestore/milestones.ts`
  - `addRisk` from `lib/firestore/risks.ts`
  - `addIssue` from `lib/firestore/issues.ts`
- Produces: a fully interactive Context tab; no new exports

---

- [ ] **Step 1: Create `components/files/file-row.tsx`**

  ```tsx
  'use client'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { cn } from '@/lib/utils'
  import type { ProjectFile } from '@/lib/types'

  interface Props {
    file: ProjectFile
    canEdit: boolean
    onProcess: (fileId: string) => void
    onSelect: (file: ProjectFile) => void
    onDelete: (fileId: string) => void
  }

  const PROCESSABLE = new Set([
    'text/plain', 'text/markdown', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ])

  function draftCount(file: ProjectFile): number {
    if (!file.aiDrafts) return 0
    return (
      file.aiDrafts.decisions.length +
      file.aiDrafts.milestones.length +
      file.aiDrafts.risks.length +
      file.aiDrafts.issues.length
    )
  }

  export function FileRow({ file, canEdit, onProcess, onSelect, onDelete }: Props) {
    const isProcessable = PROCESSABLE.has(file.mimeType)
    const status = file.aiStatus

    return (
      <div
        className={cn(
          'flex items-center justify-between border rounded-md px-4 py-3 transition-all',
          status === 'processing' && 'border-l-4 border-l-primary animate-pulse',
          status === 'ready' && 'cursor-pointer hover:bg-muted/50',
        )}
        onClick={status === 'ready' ? () => onSelect(file) : undefined}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-medium truncate">{file.name}</p>
          {status === 'ready' && file.aiSummary && (
            <p className="text-xs text-muted-foreground truncate max-w-lg">{file.aiSummary}</p>
          )}
          {status === 'processing' && (
            <p className="text-xs text-muted-foreground">Orbital is reading…</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-destructive">Processing failed</p>
          )}
          {(!status || status === 'unprocessed') && (
            <p className="text-xs text-muted-foreground">
              {(file.sizeBytes / 1024).toFixed(0)} KB · {file.uploadedAt?.slice(0, 10) ?? '—'}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          {status === 'ready' && (
            <div className="flex gap-1">
              {(file.aiDrafts?.decisions.length ?? 0) > 0 && (
                <Badge variant="secondary">{file.aiDrafts!.decisions.length} decisions</Badge>
              )}
              {(file.aiDrafts?.milestones.length ?? 0) > 0 && (
                <Badge variant="secondary">{file.aiDrafts!.milestones.length} milestones</Badge>
              )}
              {(file.aiDrafts?.risks.length ?? 0) > 0 && (
                <Badge variant="secondary">{file.aiDrafts!.risks.length} risks</Badge>
              )}
              {(file.aiDrafts?.issues.length ?? 0) > 0 && (
                <Badge variant="secondary">{file.aiDrafts!.issues.length} issues</Badge>
              )}
              {draftCount(file) === 0 && (
                <Badge variant="outline" className="text-muted-foreground">No drafts</Badge>
              )}
            </div>
          )}
          {status === 'error' && canEdit && (
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onProcess(file.id) }}>
              Retry
            </Button>
          )}
          {(!status || status === 'unprocessed') && canEdit && isProcessable && (
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onProcess(file.id) }}>
              Let Orbital read this
            </Button>
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={(e) => { e.stopPropagation(); onDelete(file.id) }}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 2: Create `components/files/file-drawer.tsx`**

  This component is a right-side panel overlay that shows AI drafts and allows Accept/Edit/Dismiss.

  ```tsx
  'use client'
  import { useState } from 'react'
  import { Button } from '@/components/ui/button'
  import { X } from 'lucide-react'
  import { cn } from '@/lib/utils'
  import type { ProjectFile } from '@/lib/types'
  import { updateFileAiDrafts } from '@/lib/firestore/files'
  import { addDecision, listDecisions } from '@/lib/firestore/decisions'
  import { addMilestone } from '@/lib/firestore/milestones'
  import { addRisk } from '@/lib/firestore/risks'
  import { addIssue } from '@/lib/firestore/issues'

  interface Props {
    file: ProjectFile
    orgId: string
    projectId: string
    uid: string
    onClose: () => void
    onDraftsChanged: () => void
  }

  type AiDrafts = NonNullable<ProjectFile['aiDrafts']>

  export function FileDrawer({ file, orgId, projectId, uid, onClose, onDraftsChanged }: Props) {
    const [drafts, setDrafts] = useState<AiDrafts>(
      file.aiDrafts ?? { decisions: [], milestones: [], risks: [], issues: [] },
    )

    async function persistDrafts(next: AiDrafts) {
      setDrafts(next)
      await updateFileAiDrafts(orgId, projectId, file.id, next)
      onDraftsChanged()
    }

    async function acceptDecision(idx: number) {
      const draft = drafts.decisions[idx]
      const existing = await listDecisions(orgId, projectId)
      const seqId = String(existing.length + 1).padStart(3, '0')
      await addDecision(orgId, projectId, {
        seqId,
        question: draft.question ?? '',
        background: draft.background ?? '',
        responsible: '', accountable: '', consulted: '', informed: '',
        priority: draft.priority ?? 'medium',
        status: draft.status ?? 'open',
        dateIdentified: new Date().toISOString().slice(0, 10),
        dueDate: '', dateDecided: '',
        outcome: draft.outcome ?? '',
        timesRevisited: 0, notes: '',
        createdBy: uid, createdAt: '', updatedAt: '',
      })
      const next = { ...drafts, decisions: drafts.decisions.filter((_, i) => i !== idx) }
      await persistDrafts(next)
    }

    async function acceptMilestone(idx: number) {
      const draft = drafts.milestones[idx]
      await addMilestone(orgId, projectId, {
        name: draft.name ?? 'New Milestone',
        status: draft.status ?? 'not_started',
        description: draft.description,
        endDate: draft.endDate,
        createdBy: uid,
      })
      const next = { ...drafts, milestones: drafts.milestones.filter((_, i) => i !== idx) }
      await persistDrafts(next)
    }

    async function acceptRisk(idx: number) {
      const draft = drafts.risks[idx]
      await addRisk(orgId, projectId, {
        title: draft.title ?? 'New Risk',
        owner: '', severity: draft.severity ?? 'medium',
        description: draft.description ?? '',
        status: 'open', createdAt: '', updatedAt: '',
      })
      const next = { ...drafts, risks: drafts.risks.filter((_, i) => i !== idx) }
      await persistDrafts(next)
    }

    async function acceptIssue(idx: number) {
      const draft = drafts.issues[idx]
      await addIssue(orgId, projectId, {
        title: draft.title ?? 'New Issue',
        owner: '', severity: draft.severity ?? 'medium',
        description: draft.description ?? '',
        status: 'open', createdAt: '', updatedAt: '',
      })
      const next = { ...drafts, issues: drafts.issues.filter((_, i) => i !== idx) }
      await persistDrafts(next)
    }

    function dismiss<K extends keyof AiDrafts>(section: K, idx: number) {
      const next = { ...drafts, [section]: (drafts[section] as unknown[]).filter((_, i) => i !== idx) }
      persistDrafts(next as AiDrafts)
    }

    const totalDrafts =
      drafts.decisions.length + drafts.milestones.length + drafts.risks.length + drafts.issues.length

    return (
      <>
        <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
        <aside className="fixed right-0 top-0 h-full w-full max-w-xl bg-background border-l shadow-xl z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
            <div>
              <p className="font-semibold text-sm truncate max-w-xs">{file.name}</p>
              <p className="text-xs text-muted-foreground">{totalDrafts} draft{totalDrafts !== 1 ? 's' : ''} remaining</p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
            {file.aiSummary && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Summary</p>
                <p className="text-sm text-foreground">{file.aiSummary}</p>
              </div>
            )}

            <DraftSection
              title="Decisions"
              items={drafts.decisions}
              renderItem={(d, idx) => (
                <DraftCard
                  key={idx}
                  label={d.question ?? '(no question)'}
                  sub={d.background}
                  onAccept={() => acceptDecision(idx)}
                  onDismiss={() => dismiss('decisions', idx)}
                />
              )}
            />

            <DraftSection
              title="Milestones"
              items={drafts.milestones}
              renderItem={(m, idx) => (
                <DraftCard
                  key={idx}
                  label={m.name ?? '(no name)'}
                  sub={m.description}
                  badge={m.status}
                  onAccept={() => acceptMilestone(idx)}
                  onDismiss={() => dismiss('milestones', idx)}
                />
              )}
            />

            <DraftSection
              title="Risks"
              items={drafts.risks}
              renderItem={(r, idx) => (
                <DraftCard
                  key={idx}
                  label={r.title ?? '(no title)'}
                  sub={r.description}
                  badge={r.severity}
                  onAccept={() => acceptRisk(idx)}
                  onDismiss={() => dismiss('risks', idx)}
                />
              )}
            />

            <DraftSection
              title="Issues"
              items={drafts.issues}
              renderItem={(iss, idx) => (
                <DraftCard
                  key={idx}
                  label={iss.title ?? '(no title)'}
                  sub={iss.description}
                  badge={iss.severity}
                  onAccept={() => acceptIssue(idx)}
                  onDismiss={() => dismiss('issues', idx)}
                />
              )}
            />

            {totalDrafts === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">All drafts reviewed.</p>
            )}
          </div>
        </aside>
      </>
    )
  }

  function DraftSection<T>({
    title,
    items,
    renderItem,
  }: {
    title: string
    items: T[]
    renderItem: (item: T, idx: number) => React.ReactNode
  }) {
    if (items.length === 0) return null
    return (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
        <div className="flex flex-col gap-2">{items.map((item, idx) => renderItem(item, idx))}</div>
      </div>
    )
  }

  function DraftCard({
    label, sub, badge, onAccept, onDismiss,
  }: {
    label: string
    sub?: string
    badge?: string
    onAccept: () => void
    onDismiss: () => void
  }) {
    return (
      <div className="border rounded-md px-4 py-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{label}</p>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{badge}</span>
          )}
        </div>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        <div className="flex gap-2 mt-1">
          <Button size="sm" onClick={onAccept}>Accept</Button>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onDismiss}>Dismiss</Button>
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 3: Rewrite `app/(pm)/projects/[projectId]/files/page.tsx`**

  ```tsx
  'use client'
  import { useState } from 'react'
  import { useParams } from 'next/navigation'
  import { useQuery, useQueryClient } from '@tanstack/react-query'
  import { useAuth } from '@/hooks/use-auth'
  import { useOrgId } from '@/hooks/use-org'
  import { useProject } from '@/hooks/use-project'
  import { listFiles, deleteFile } from '@/lib/firestore/files'
  import { FileUploadButton } from '@/components/files/file-upload-button'
  import { FileRow } from '@/components/files/file-row'
  import { FileDrawer } from '@/components/files/file-drawer'
  import type { ProjectFile } from '@/lib/types'

  export default function FilesPage() {
    const { projectId } = useParams<{ projectId: string }>()
    const { user } = useAuth()
    const orgId = useOrgId()
    const qc = useQueryClient()
    const { data: project } = useProject(orgId, projectId)
    const [selected, setSelected] = useState<ProjectFile | null>(null)

    const { data: files = [], isLoading } = useQuery({
      queryKey: ['files', orgId, projectId],
      queryFn: () => listFiles(orgId!, projectId),
      enabled: !!orgId,
      refetchInterval: (query) => {
        const data = query.state.data as ProjectFile[] | undefined
        return data?.some((f) => f.aiStatus === 'processing') ? 3000 : false
      },
    })

    const canEdit = user && project
      ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
      : false

    const inv = () => qc.invalidateQueries({ queryKey: ['files', orgId, projectId] })

    async function handleProcess(fileId: string) {
      if (!orgId) return
      await fetch('/api/files/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, projectId, fileId }),
      })
      inv()
    }

    async function handleDelete(fileId: string) {
      if (!orgId) return
      await deleteFile(orgId, projectId, fileId)
      if (selected?.id === fileId) setSelected(null)
      inv()
    }

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Context</h2>
          {canEdit && orgId && (
            <FileUploadButton orgId={orgId} projectId={projectId} onUploaded={inv} />
          )}
        </div>

        {isLoading && <p className="text-muted-foreground text-sm">Loading…</p>}
        {!isLoading && files.length === 0 && (
          <p className="text-muted-foreground text-sm">No files uploaded yet.</p>
        )}

        <div className="flex flex-col gap-2">
          {files.map((f) => (
            <FileRow
              key={f.id}
              file={f}
              canEdit={canEdit}
              onProcess={handleProcess}
              onSelect={setSelected}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {selected && orgId && user && (
          <FileDrawer
            file={selected}
            orgId={orgId}
            projectId={projectId}
            uid={user.uid}
            onClose={() => setSelected(null)}
            onDraftsChanged={inv}
          />
        )}
      </div>
    )
  }
  ```

- [ ] **Step 4: Manual test**

  - Upload a plain text transcript file
  - Verify the row shows "Orbital is reading…" while processing
  - After 10–30s, verify it shows summary + badge counts
  - Click the row → drawer opens
  - Click "Accept" on a decision → verify it appears in the Decisions tab
  - Click "Dismiss" on a risk → verify it disappears from the drawer

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add components/files/file-row.tsx components/files/file-drawer.tsx "app/(pm)/projects/[projectId]/files/page.tsx"
  git commit -m "$(cat <<'EOF'
  feat: redesign Context tab with AI file states and draft drawer

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 8: Redesign Overview as Command Center

**Files:**
- Modify: `app/(pm)/projects/[projectId]/overview/page.tsx`

**Interfaces:**
- Consumes:
  - `listFiles` from `lib/firestore/files.ts`
  - `POST /api/files/query` (streaming)
  - `useProject`, `useOrgId`, `useAuth` hooks
  - `updateProject` from `lib/firestore/projects.ts`

---

- [ ] **Step 1: Rewrite `app/(pm)/projects/[projectId]/overview/page.tsx`**

  ```tsx
  'use client'
  import { useState, useRef, useEffect } from 'react'
  import { useParams, useRouter } from 'next/navigation'
  import { useQuery, useQueryClient } from '@tanstack/react-query'
  import { useAuth } from '@/hooks/use-auth'
  import { useOrgId } from '@/hooks/use-org'
  import { useProject } from '@/hooks/use-project'
  import { listFiles } from '@/lib/firestore/files'
  import { updateProject, archiveProject } from '@/lib/firestore/projects'
  import { Badge } from '@/components/ui/badge'
  import { Button } from '@/components/ui/button'
  import { Input } from '@/components/ui/input'
  import { ShareDialog } from '@/components/projects/share-dialog'
  import type { ProjectFile } from '@/lib/types'

  function StatusBadge({ label, status }: { label: string; status: string }) {
    const color =
      status === 'on_track' ? 'text-green-700 border-green-300'
      : status === 'at_risk' ? 'text-yellow-700 border-yellow-300'
      : 'text-red-700 border-red-300'
    return (
      <Badge variant="outline" className={color}>
        {label}: {status.replace('_', ' ')}
      </Badge>
    )
  }

  function IntelligenceFeed({ files }: { files: ProjectFile[] }) {
    const ready = files
      .filter((f) => f.aiStatus === 'ready')
      .sort((a, b) => (b.aiProcessedAt ?? '').localeCompare(a.aiProcessedAt ?? ''))
      .slice(0, 5)

    if (ready.length === 0) {
      return (
        <div className="border border-dashed rounded-md px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            Drop your first meeting transcript into Context and Orbital will read it.
          </p>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-2">
        {ready.map((f) => {
          const counts = [
            f.aiDrafts?.decisions.length && `${f.aiDrafts.decisions.length} decisions`,
            f.aiDrafts?.milestones.length && `${f.aiDrafts.milestones.length} milestones`,
            f.aiDrafts?.risks.length && `${f.aiDrafts.risks.length} risks`,
            f.aiDrafts?.issues.length && `${f.aiDrafts.issues.length} issues`,
          ].filter(Boolean)

          return (
            <div key={f.id} className="border rounded-md px-4 py-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.aiProcessedAt?.slice(0, 10) ?? ''}</p>
              </div>
              {f.aiSummary && <p className="text-xs text-muted-foreground">{f.aiSummary}</p>}
              {counts.length > 0 && (
                <p className="text-xs text-primary font-medium">{counts.join(' · ')}</p>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  function AskOrbital({ orgId, projectId }: { orgId: string; projectId: string }) {
    const [question, setQuestion] = useState('')
    const [answer, setAnswer] = useState('')
    const [loading, setLoading] = useState(false)

    async function handleSubmit(e: React.FormEvent) {
      e.preventDefault()
      if (!question.trim() || loading) return
      setLoading(true)
      setAnswer('')
      try {
        const res = await fetch('/api/files/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orgId, projectId, question }),
        })
        if (!res.ok || !res.body) {
          setAnswer('Something went wrong. Try again.')
          return
        }
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let full = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          full += decoder.decode(value, { stream: true })
          const citationIdx = full.lastIndexOf('\nCITATIONS:')
          setAnswer(citationIdx >= 0 ? full.slice(0, citationIdx) : full)
        }
      } finally {
        setLoading(false)
      }
    }

    return (
      <div className="flex flex-col gap-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything about this project…"
            disabled={loading}
            className="flex-1"
          />
          <Button type="submit" disabled={loading || !question.trim()}>
            {loading ? 'Asking…' : 'Ask'}
          </Button>
        </form>
        {answer && (
          <div className="border rounded-md px-4 py-3 text-sm whitespace-pre-wrap">{answer}</div>
        )}
      </div>
    )
  }

  export default function OverviewPage() {
    const { projectId } = useParams<{ projectId: string }>()
    const { user } = useAuth()
    const orgId = useOrgId()
    const qc = useQueryClient()
    const router = useRouter()
    const { data: project } = useProject(orgId, projectId)
    const [shareOpen, setShareOpen] = useState(false)
    const [archiving, setArchiving] = useState(false)

    const { data: files = [] } = useQuery({
      queryKey: ['files', orgId, projectId],
      queryFn: () => listFiles(orgId!, projectId),
      enabled: !!orgId,
    })

    const isOwner = user && project ? project.members[user.uid] === 'owner' : false
    const canEdit = user && project
      ? project.members[user.uid] === 'owner' || project.members[user.uid] === 'editor'
      : false

    async function handleArchiveToggle() {
      if (!orgId || !project) return
      setArchiving(true)
      const newStatus = project.status === 'archived' ? 'active' : 'archived'
      await updateProject(orgId, projectId, { status: newStatus })
      qc.invalidateQueries({ queryKey: ['project', orgId, projectId] })
      qc.invalidateQueries({ queryKey: ['projects', orgId] })
      if (newStatus === 'archived') router.push('/dashboard')
      setArchiving(false)
    }

    if (!project) return <p className="text-muted-foreground text-sm">Loading…</p>

    return (
      <div className="flex flex-col gap-8 max-w-3xl">
        {/* Zone 1 — Pulse strip */}
        {project.statusHeader && (
          <div className="flex gap-2 flex-wrap">
            <StatusBadge label="Schedule" status={project.statusHeader.scheduleStatus} />
            <StatusBadge label="Budget" status={project.statusHeader.budgetStatus} />
            <StatusBadge label="Scope" status={project.statusHeader.scopeStatus} />
          </div>
        )}

        {/* Zone 2 — Intelligence feed */}
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent Intelligence</h2>
          <IntelligenceFeed files={files} />
        </div>

        {/* Zone 3 — Ask Orbital */}
        {orgId && (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Ask Orbital</h2>
            <AskOrbital orgId={orgId} projectId={projectId} />
          </div>
        )}

        {/* Project settings — below the fold */}
        <div className="border-t pt-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Project Settings</h2>
          <div>
            <h3 className="font-medium mb-2 text-sm">Members</h3>
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
          {isOwner && (
            <Button
              variant="outline"
              onClick={handleArchiveToggle}
              disabled={archiving}
              className="self-start text-muted-foreground"
            >
              {archiving ? 'Saving…' : project.status === 'archived' ? 'Unarchive' : 'Archive project'}
            </Button>
          )}
        </div>

        <ShareDialog
          projectId={projectId}
          open={shareOpen}
          onOpenChange={setShareOpen}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Manual test**

  - Open any project → lands on Overview
  - If no processed files: see the empty prompt card
  - After processing a file: Intelligence Feed shows it with summary + pill counts
  - Type a question in Ask Orbital, hit Ask → answer streams in
  - Members section and Archive button still work at the bottom

- [ ] **Step 3: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add "app/(pm)/projects/[projectId]/overview/page.tsx"
  git commit -m "$(cat <<'EOF'
  feat: redesign project overview as AI command center

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 9: Rename tab label + landing page SEO overhaul

**Files:**
- Modify: `components/layout/project-tabs.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/page.tsx`

---

- [ ] **Step 1: Rename "Files" → "Context" in `components/layout/project-tabs.tsx`**

  In `STATIC_BEFORE`, change:
  ```ts
  { label: 'Files', segment: 'files' },
  ```
  to:
  ```ts
  { label: 'Context', segment: 'files' },
  ```

- [ ] **Step 2: Update metadata in `app/layout.tsx`**

  Replace the `metadata` export:

  ```ts
  export const metadata: Metadata = {
    title: 'Orbital — AI Project Intelligence',
    description:
      'Drop in your meeting transcripts and files. Orbital reads them, extracts decisions, flags risks, and updates your project — automatically.',
    keywords: [
      'meeting transcript AI',
      'AI project management',
      'meeting intelligence',
      'action items from meetings',
      'AI project assistant',
    ],
    openGraph: {
      title: 'Orbital — AI Project Intelligence',
      description: 'The AI member of your team that never misses a meeting.',
      type: 'website',
    },
  }
  ```

- [ ] **Step 3: Rewrite `app/page.tsx` as the SEO landing page**

  Replace the entire page:

  ```tsx
  import { cookies } from 'next/headers'
  import { redirect } from 'next/navigation'
  import { adminAuth } from '@/lib/firebase/admin'
  import { GoogleSignInButton } from '@/components/auth/google-sign-in-button'
  import { LogoHealthStream } from '@/components/ui/logo'

  const COOKIE = process.env.SESSION_COOKIE_NAME ?? '__session'

  const SCHEMA = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Orbital',
    applicationCategory: 'BusinessApplication',
    description:
      'Orbital reads your meeting transcripts and files, then automatically drafts decisions, milestones, risks, and action items into your project.',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0' },
  }

  const HOW_IT_WORKS = [
    {
      step: '01',
      title: 'Drop it in',
      desc: 'Upload your meeting transcript, PDF, or slide deck to any project. Any format.',
    },
    {
      step: '02',
      title: 'Orbital reads it',
      desc: 'Claude Sonnet analyzes the document and extracts decisions, milestones, risks, and issues — in seconds.',
    },
    {
      step: '03',
      title: 'Your project updates',
      desc: 'Review the AI drafts and accept the ones that matter. One click moves them into the right place.',
    },
  ]

  const EXTRACTS = [
    { label: 'Decisions', desc: 'What was agreed, who owns it, what the outcome was.' },
    { label: 'Milestones', desc: 'Dates, deliverables, and status from the conversation.' },
    { label: 'Risks', desc: 'What could go wrong, flagged before it becomes a problem.' },
    { label: 'Issues', desc: 'Blockers and open questions, ready to assign and resolve.' },
  ]

  export default async function Home() {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(COOKIE)?.value
    if (sessionCookie) {
      try {
        await adminAuth.verifySessionCookie(sessionCookie, true)
        redirect('/dashboard')
      } catch {}
    }

    return (
      <>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(SCHEMA) }}
        />
        <main className="min-h-screen flex flex-col bg-background text-foreground">
          {/* Hero */}
          <section className="flex flex-col items-center justify-center text-center px-4 pt-24 pb-16 gap-6">
            <LogoHealthStream className="h-8 w-auto mb-2" />
            <h1 className="text-4xl font-bold tracking-tight max-w-2xl leading-tight">
              The AI member of your team that never misses a meeting.
            </h1>
            <p className="text-lg text-muted-foreground max-w-xl">
              Drop in your transcripts and files. Orbital reads them, extracts decisions, flags risks,
              and drafts action items into your project — automatically.
            </p>
            <div className="w-full max-w-sm bg-card border rounded-lg p-6 mt-4">
              <p className="text-sm text-muted-foreground text-center mb-6">Sign in to get started</p>
              <GoogleSignInButton />
            </div>
          </section>

          {/* How it works */}
          <section className="px-4 py-16 max-w-4xl mx-auto w-full">
            <h2 className="text-2xl font-semibold text-center mb-10">How it works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map(({ step, title, desc }) => (
                <div key={step} className="flex flex-col gap-2">
                  <span className="text-3xl font-bold text-muted-foreground/40">{step}</span>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* What Orbital extracts */}
          <section className="px-4 py-16 bg-muted/30">
            <div className="max-w-4xl mx-auto w-full">
              <h2 className="text-2xl font-semibold text-center mb-10">What Orbital extracts</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {EXTRACTS.map(({ label, desc }) => (
                  <div key={label} className="border rounded-md px-5 py-4 bg-background flex flex-col gap-1">
                    <p className="font-semibold">{label}</p>
                    <p className="text-sm text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Ask Orbital */}
          <section className="px-4 py-16 max-w-4xl mx-auto w-full text-center flex flex-col items-center gap-4">
            <h2 className="text-2xl font-semibold">Ask Orbital anything</h2>
            <p className="text-muted-foreground max-w-lg">
              Once your files are processed, ask natural language questions about your project.
              Orbital searches across all your documents and answers with citations.
            </p>
            <div className="font-mono text-sm bg-muted rounded-md px-4 py-3 text-left max-w-md w-full">
              <span className="text-muted-foreground">You: </span>
              What did we decide about the API design last week?
            </div>
          </section>

          <footer className="text-center text-xs text-muted-foreground py-8 border-t">
            © {new Date().getFullYear()} Orbital
          </footer>
        </main>
      </>
    )
  }
  ```

- [ ] **Step 4: Run full test suite**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital && npm test
  ```

  Expected: all tests PASS.

- [ ] **Step 5: Commit**

  ```bash
  cd /Users/bryce/40au/Projekt/orbital
  git add components/layout/project-tabs.tsx app/layout.tsx app/page.tsx
  git commit -m "$(cat <<'EOF'
  feat: rename Files tab to Context and overhaul landing page SEO

  Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
  EOF
  )"
  ```

---

## Summary

| Task | Deliverable |
|---|---|
| 1 | `ProjectFile` type extended, `updateFileAiDrafts` with tests |
| 2 | `@anthropic-ai/sdk` and `pdf-parse` installed |
| 3 | `lib/ai/extract.ts` — Claude extraction with tests |
| 4 | `POST /api/files/process` — download → extract → write drafts |
| 5 | `POST /api/files/query` — streaming Q&A over file summaries |
| 6 | `FileUploadButton` auto-triggers processing on upload |
| 7 | Context tab with file states, drawer, Accept/Dismiss |
| 8 | Overview redesigned as Command Center |
| 9 | Tab renamed, landing page SEO overhaul |

All work on branch `feature/meeting-intelligence`. Do not merge to `main`.
