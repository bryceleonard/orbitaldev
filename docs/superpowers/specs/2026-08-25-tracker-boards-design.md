# Orbital — Tracker Boards Design Spec
**Date:** 2026-08-25
**Author:** Bryce Leonard (FortyAU)
**Status:** Approved for implementation

---

## Overview

Projects in Orbital connect to issue trackers for a read-only developer-reality view. Some projects use Azure DevOps Work Items; others use Beads, a local-first issue tracker that stores issues as JSONL files in the git repo. A single project (SOW) may span multiple sub-projects, each needing its own board — for example, Quattro has two separate ADO projects with independent boards.

This spec replaces the hardcoded single ADO integration with an extensible **`trackerBoards` array** on each project. Each board is independently configured, gets its own labeled tab in both the PM workspace and client portal, and renders the appropriate view based on its type. Future tracker vendors (GitHub Issues, Linear, Jira) can be added without schema changes.

---

## Background: What Is Beads?

Beads (`br`, the Rust implementation) is a local-first issue tracker that stores data in a `.beads/` directory inside the code repository:

- **`beads.db`** — SQLite primary store (fast local queries)
- **`issues.jsonl`** — JSONL export (one JSON object per line; git-friendly, mergeable)
- **`config.yaml`** — Optional project config

Developers manage issues via CLI (`br create`, `br close`, etc.) or a desktop app. Issues are never managed through Orbital — it is read-only.

**Issue fields:** `id`, `title`, `type` (bug/feature/task), `priority` (0=critical → 4=backlog), `status` (open/in_progress/in_review/rework/closed/deferred), `assignee`, `labels`, `description`, `dependencies`, `acceptance_criteria`, `created_at`, `updated_at`.

**Epics:** Beads supports parent-child hierarchies via `br epic`. Each epic rolls up its children's status. The Orbital Beads view defaults to epic-level grouping with expandable children, giving PMs the right altitude.

**No sprints.** Beads organizes work by dependency and priority, not time-boxes. This is a deliberate design choice.

### PM role shift with Beads

With ADO Work Items, the PM owns the tracker — creating stories, managing sprints, moving items. With Beads, developers own the tracker in their native environment. The PM's role shifts from *managing* the tracker to *synthesizing developer reality into stakeholder communication*. The SOW, status, risks, and roadmap tabs in Orbital remain PM-owned artifacts; the Beads board is the "what are devs actually doing" lens. For dev-centric shops this is a better split.

---

## Data Model

### `TrackerBoard` (new type in `lib/types.ts`)

```ts
export type TrackerType = 'ado' | 'beads'

export interface TrackerBoard {
  id: string           // client-generated uuid
  label: string        // display name, e.g. "Quattro Alpha"
  type: TrackerType
  // ADO connection — required for both types (Beads reads from ADO-hosted repo)
  adoOrgUrl: string    // e.g. "https://dev.azure.com/myorg"
  adoProject: string   // ADO project name
  adoPat: string       // AES-256-GCM encrypted at rest
  // ADO Work Items only
  adoTeam: string
  // Beads only
  beadsRepo: string    // ADO repo name containing .beads/
  beadsBranch: string  // defaults to 'main'
}
```

### `Project` changes

Remove flat ADO fields (`adoOrgUrl`, `adoProject`, `adoTeam`, `adoPat`) and replace with:

```ts
trackerBoards: TrackerBoard[]  // replaces adoOrgUrl/adoProject/adoTeam/adoPat
```

`createProject` gains an optional first `TrackerBoard` entry. Projects with no tracker at creation have `trackerBoards: []`.

### `BeadsIssue` (new type)

```ts
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
  parentId?: string    // set when issue belongs to an epic
  created_at: string
  updated_at: string
}
```

### Caching

Extend the existing `adoCache` subcollection. Add `type: 'beads-issues'` alongside `'sprint'`, `'backlog'`, `'devplan'` in the `AdoCache` type union. Add a `boardId: string` field to `AdoCache` so multiple boards on the same project don't collide (existing single-board projects can default `boardId` to `''`).

---

## Project Creation

`ProjectForm` adds a tracker selection step between description and submit:

1. **Radio group — "Issue tracker":**
   - ADO Work Items
   - Beads
   - None (configure later)

2. **Label field** (shown when ADO or Beads is selected): short name for this board, e.g. "Alpha", "Backend". Defaults to the project name.

3. On submit, `createProject` receives `{ firstBoard?: Omit<TrackerBoard, 'id' | 'adoPat'> }`. The PAT is not collected at creation — it's added from the Overview tab after the project exists.

---

## Tab System

### PM workspace

`ProjectTabs` receives `trackerBoards: TrackerBoard[]` as a prop (the project layout already fetches the project). Static tabs render in fixed positions; board tabs are inserted between Files and Stakeholders.

**Tab order:** Overview · SOW · Status · Files · *[board tabs]* · Stakeholders · Links · Roadmap

Each board tab is labeled with `board.label` and routes to `/projects/[projectId]/boards/[boardId]`.

The existing hardcoded `ADO Board` and `Dev Plan` tab entries are removed. The existing `/ado` and `/dev-plan` routes are removed.

### Client portal

Same pattern: `PortalProjectTabs` reads `trackerBoards` from the project and renders one tab per board, routing to `/portal/[projectId]/boards/[boardId]`. Clients see the last-synced snapshot with no Sync button.

---

## Board Routes

### PM workspace — `app/(pm)/projects/[projectId]/boards/[boardId]/page.tsx`

Single dynamic route. Reads `board.type` from the project's `trackerBoards` array and renders:

- **`type === 'ado'`** — ADO sprint board (kanban by state) with internal sub-tabs: Sprint | Dev Plan. Mirrors current `/ado` and `/dev-plan` page content. Sync button re-fetches via API.
- **`type === 'beads'`** — Beads issues view (see below). Sync button re-fetches `.beads/issues.jsonl`.

### Client portal — `app/(client)/portal/[projectId]/boards/[boardId]/page.tsx`

Same as PM view but no Sync button. Shows last-synced data.

---

## Beads Board View

A filterable table defaulting to **epic-level grouping**:

- Epics (issues with children) shown as collapsible rows with inline progress bar (X of N children closed)
- Non-epic issues shown flat below grouped section
- Columns: ID · Title · Type · Priority · Status · Assignee · Labels
- Filter controls: Status (multi-select) · Priority (multi-select) · Type (multi-select)
- Click a row → side panel showing Description, Acceptance Criteria, Dependencies

Priority display: Critical · High · Medium · Low · Backlog (colored badges)
Status display: color-coded badges matching Beads status names

---

## Board Sync API Route

`GET /api/boards/[projectId]/[boardId]?type=sprint&force=0`

Replaces the existing `/api/ado/[projectId]` route. Handles all board types.

**ADO Work Items boards** — same logic as the existing ADO proxy route: calls ADO Work Items / Iterations APIs with `type` = `sprint` | `backlog` | `devplan`. Cached under `type: 'sprint'` / `'backlog'` / `'devplan'` with `boardId`.

**Beads boards** — `type` parameter is ignored; always fetches issues:

1. Verify session cookie (existing pattern)
2. Load project from Firestore, find board by `boardId`
3. If cache exists and `force` is not set, return cached data
4. Decrypt PAT server-side (existing AES-256-GCM module)
5. Call ADO Git content API:
   ```
   GET {adoOrgUrl}/{adoProject}/_apis/git/repositories/{beadsRepo}/items
     ?path=.beads/issues.jsonl
     &versionDescriptor.version={beadsBranch}
     &api-version=7.1
   ```
6. Split response by newline, parse each line as JSON, filter blank lines
7. Write result to `adoCache` subcollection (`type: 'beads-issues'`, `boardId`)
8. Return `{ issues: BeadsIssue[], fetchedAt: string }`

**Note:** The exact field name for parent-child relationships in `issues.jsonl` (used to identify epics) should be verified against a real Beads repo before coding the epic grouping logic. Expected to be `parentId` or `parent_id` based on CLI docs.

---

## Overview Tab — Board Management

`AdoConfigSection` is replaced by a **Boards** card (owner-only).

- Lists current `trackerBoards` — each row shows label, type badge, Edit / Remove actions
- "Add board" button opens an inline form
- Edit form fields by type:
  - **ADO:** Label · ADO Org URL · ADO Project · ADO Team · PAT
  - **Beads:** Label · ADO Org URL · ADO Project · PAT · Repo name · Branch (default: main)
- Save calls `POST /api/boards/configure/[projectId]` — encrypts PAT server-side, writes updated `trackerBoards` array to Firestore
- Remove deletes the board entry and its cached data

---

## Files Changed

| File | Action |
|---|---|
| `lib/types.ts` | Add `TrackerType`, `TrackerBoard`, `BeadsIssue`; replace flat ADO fields on `Project` with `trackerBoards` |
| `lib/firestore/projects.ts` | Update `createProject` to accept optional first board |
| `components/projects/project-form.tsx` | Add tracker radio + label field |
| `components/layout/project-tabs.tsx` | Accept `trackerBoards` prop; render dynamic board tabs |
| `app/(pm)/projects/[projectId]/layout.tsx` | Pass `trackerBoards` to `ProjectTabs` |
| `app/(pm)/projects/[projectId]/boards/[boardId]/page.tsx` | New — renders ADO or Beads view |
| `app/(pm)/projects/[projectId]/overview/page.tsx` | Replace `AdoConfigSection` with Boards card |
| `app/(pm)/projects/[projectId]/ado/page.tsx` | Removed |
| `app/(pm)/projects/[projectId]/dev-plan/page.tsx` | Removed (content moved into board page sub-tab) |
| `app/api/boards/[projectId]/[boardId]/route.ts` | New — unified board sync (ADO or Beads) |
| `app/api/boards/configure/[projectId]/route.ts` | New — replaces `/api/ado/configure/[projectId]` |
| `app/api/ado/[projectId]/route.ts` | Removed (replaced by boards API) |
| `app/api/ado/configure/[projectId]/route.ts` | Removed |
| `components/portal/portal-project-tabs.tsx` | Dynamic board tabs |
| `app/(client)/portal/[projectId]/ado/page.tsx` | Removed |
| `app/(client)/portal/[projectId]/boards/[boardId]/page.tsx` | New — portal board view |
