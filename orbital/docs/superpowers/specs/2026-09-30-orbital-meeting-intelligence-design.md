# Orbital Meeting Intelligence — Design Spec

**Date:** 2026-09-30  
**Status:** Approved  
**Author:** Bryce Leonard

---

## Vision

Orbital becomes the AI member of your team that never misses a meeting. Every file you give it — transcript, PDF, slide deck — gets read, understood, and turned into actionable project artifacts: decisions, milestones, risks, and issues. The project overview is a command center, not a settings form.

---

## Scope

This spec covers:
1. Extending `ProjectFile` with AI processing fields
2. Redesigning the Files tab as "Context"
3. Redesigning the project Overview as the Command Center (default landing tab)
4. Two new API routes: process and query
5. Landing page SEO overhaul

Out of scope for this iteration: Beads/ADO ticket creation from extracted items, team collaboration on drafts, email forwarding of transcripts.

---

## 1. Data Model

### Extended `ProjectFile` (no new collection)

Extend the existing `ProjectFile` type in `lib/types.ts`. All new fields are optional — existing files without them are treated as `unprocessed`.

```ts
export interface ProjectFile {
  // --- existing fields, unchanged ---
  id: string
  name: string
  storagePath: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
  sharedWithClient: boolean

  // --- new AI fields ---
  aiStatus?: 'unprocessed' | 'processing' | 'ready' | 'error'
  aiSummary?: string           // 2–3 sentence AI-generated summary
  aiProcessedAt?: string       // ISO timestamp
  aiDrafts?: {
    decisions: Partial<Decision>[]
    milestones: Partial<Milestone>[]
    risks: Partial<Risk>[]
    issues: Partial<Issue>[]
  }
}
```

**Key constraints:**
- `aiDrafts` items are `Partial<>` — they are proposals, not committed records
- Accepting a draft writes it as a full record into the appropriate Firestore subcollection (decisions, milestones, risks, issues) and removes it from `aiDrafts`
- Dismissing a draft removes it from `aiDrafts` with no other side effects
- Editing a draft modifies it in-place in `aiDrafts` before accepting

### Supported file types for AI processing
Plain text (`.txt`), Markdown (`.md`), PDF (`.pdf`), PowerPoint (`.pptx`), and slide exports. The UI shows the "Let Orbital read this" button for all of these. Other file types (images, zips, etc.) show no AI affordance.

---

## 2. Routes

### Renamed tab: Files → Context

In `components/layout/project-tabs.tsx`, rename the `'Files'` label to `'Context'`. The route segment stays `files` to avoid breaking existing links.

### `/projects/[projectId]` — default redirect

Already redirects to `overview`. No change needed. The Overview page itself is what changes.

### `/projects/[projectId]/overview` — Command Center (default landing tab)

The project landing experience. Replaces the current name/description form. Three zones:

**Zone 1 — Pulse Strip (top)**  
Existing `StatusHeader` badges (schedule / budget / scope). Unchanged functionally, tightened visually.

**Zone 2 — Intelligence Feed (center)**  
A chronological list of the 5 most recently processed files. Each entry shows:
- File name and date processed
- One-line AI summary
- Pill badges: `2 decisions · 1 risk · 3 action items`
- Click → opens the Context tab file drawer directly

If no files have been processed yet, the feed shows a single prompt card: *"Drop your first meeting transcript into Context and Orbital will read it."*

**Zone 3 — Ask Orbital (bottom)**  
A full-width input: *"Ask anything about this project…"*  
On submit, calls `POST /api/files/query`. The answer streams back inline below the input with source citations linking to the originating file. One question at a time — no persistent chat history in v1.

**Project name/description editing** moves to an edit-in-place interaction on the page header (click the title to edit inline), so the Overview body is entirely intelligence-focused.

### `/projects/[projectId]/files` — Context Tab

Same route, significantly enhanced UI.

**File list — three visual states:**

| State | Visual treatment |
|---|---|
| `unprocessed` | Standard row. "Let Orbital read this" button (only for supported types). |
| `processing` | Row has a subtle pulsing left border. "Orbital is reading…" replaces the button. |
| `ready` | Row shows a one-line summary truncated to ~80 chars. Badge pills show extraction counts. Entire row is clickable. |
| `error` | Row shows "Processing failed" with a Retry button. |

**File detail drawer (right side)**  
Opens on click of any `ready` file. Contains:
- Full AI summary
- Four collapsible sections: Decisions, Milestones, Risks, Issues
- Each draft item renders as a card matching the visual style of its destination tab
- Each card has three actions: **Accept** (writes to Firestore, removes from drafts), **Edit** (inline edit of fields before accepting), **Dismiss** (removes from drafts)
- A "Accept all" shortcut at the top of each section

Upload flow is unchanged — `FileUploadButton` component stays. After upload completes, if the file type is processable, Orbital auto-triggers processing immediately (no manual step required for new uploads). The "Let Orbital read this" button exists only for files uploaded before this feature shipped.

---

## 3. API Routes

### `POST /api/files/process`

**Purpose:** Download a file from Firebase Storage, extract structured intelligence with Claude, write results back to Firestore.

**Request body:**
```ts
{ orgId: string, projectId: string, fileId: string }
```

**Flow:**
1. Verify Firebase auth token from `Authorization` header
2. Confirm caller is `owner` or `editor` on the project
3. Fetch `ProjectFile` from Firestore — reject if `aiStatus` is already `processing` or `ready`
4. Set `aiStatus: 'processing'` in Firestore
5. Download file bytes from Firebase Storage
6. Convert to text (PDF: use `pdf-parse`; PPTX: extract text nodes; txt/md: direct)
7. Send to Claude Sonnet 4.6 with a structured extraction prompt (see Prompt Design below)
8. Parse JSON response into `aiDrafts`
9. Write `aiStatus: 'ready'`, `aiSummary`, `aiProcessedAt`, `aiDrafts` to Firestore
10. On any error: set `aiStatus: 'error'`

**Response:** `200 OK` with `{ fileId, aiStatus: 'ready' }` — client invalidates the files query on receipt.

**Prompt design:**
The system prompt instructs Claude to extract structured JSON with four arrays: `decisions`, `milestones`, `risks`, `issues`. Each array item maps directly to `Partial<Decision>`, `Partial<Milestone>`, `Partial<Risk>`, `Partial<Issue>`. Claude is told to only extract items that are clearly evidenced in the document — no hallucination, no padding. A `summary` field (2–3 sentences) is also requested.

### `POST /api/files/query`

**Purpose:** Answer a natural language question using all processed files in a project as context.

**Request body:**
```ts
{ orgId: string, projectId: string, question: string }
```

**Flow:**
1. Auth + role check (owner, editor, viewer all allowed)
2. Fetch all `ProjectFile` records where `aiStatus === 'ready'`
3. Concatenate `aiSummary` fields with file name labels as context (summaries only, not full content — keeps cost low and latency fast)
4. Send to Claude Sonnet 4.6 with the question and context
5. Stream response back to client via `ReadableStream`

**Response:** Streaming text, followed by a JSON footer with `citations: { fileId, fileName }[]` for source attribution.

---

## 4. Landing Page SEO Overhaul

**File:** `app/page.tsx`

**New positioning:** Orbital is the AI member of your team that never misses a meeting.

**Updated metadata (`app/layout.tsx`):**
```ts
export const metadata: Metadata = {
  title: 'Orbital — AI Project Intelligence',
  description: 'Drop in your meeting transcripts and files. Orbital reads them, extracts decisions, flags risks, and updates your project — automatically.',
  keywords: ['meeting transcript AI', 'AI project management', 'meeting intelligence', 'action items from meetings'],
  openGraph: {
    title: 'Orbital — AI Project Intelligence',
    description: 'The AI member of your team that never misses a meeting.',
    type: 'website',
  },
}
```

**Schema.org structured data** (`SoftwareApplication`) added via a `<script type="application/ld+json">` in the layout.

**Landing page sections:**
1. Hero — headline + subhead + CTA
2. How it works — 3 steps: Drop it in → Orbital reads it → Your project updates
3. What Orbital extracts — decisions, milestones, risks, issues
4. Ask Orbital — the query feature
5. Pricing / CTA (link to sign up — no pricing table in v1)

The page stays lightweight: no heavy JS, server-rendered, fast LCP. Same approach as Pismogo's landing page.

---

## 5. Firestore Security Rules

No new collections. Existing rules already gate `files` subcollection writes to `owner` and `editor`. The AI processing API routes enforce the same role check server-side before any write.

---

## 6. Dependencies to Add

- `pdf-parse` — extract text from PDF files server-side
- `@anthropic-ai/sdk` — Claude Sonnet 4.6 API calls
- `mammoth` (optional) — PPTX/DOCX text extraction; evaluate at implementation time

---

## 7. Out of Scope (Future)

- Email forwarding: forward a transcript to `project-xyz@orbital.app` → auto-processes
- Team collaboration on drafts (comments, assignments before accepting)
- Beads issue creation from extracted action items
- Full document content search (v1 uses summaries only for query)
- Cross-project intelligence ("what have we decided about auth across all projects?")
