# Orbital — Design Spec
**Date:** 2026-08-21  
**Revised:** 2026-08-23  
**Author:** Bryce Leonard (FortyAU)  
**Status:** Approved for implementation

---

## Overview

Orbital is a dual-sided B2B SaaS application for agency project management. It gives agency team members a unified workspace to manage client engagements — combining uploaded context files, structured project data (SOW, risks, issues, stakeholders), and a read-only Azure DevOps integration — while exposing a curated, professional client portal for stakeholder-facing project visibility.

Starting as an internal FortyAU tool, Orbital is architected as multi-tenant SaaS from day one so it can be sold to other agencies managing enterprise client accounts.

---

## Users & Roles

Access is project-scoped, not org-scoped. Think Google Docs — a project has an owner, and the owner shares it with others at a specific access level. There is no org-level superuser.

**Owner**  
The user who created the project. Full control: edit all data, manage sharing, archive or delete the project. Sees all their owned projects plus any projects shared with them.

**Editor**  
A user the owner has added with edit access. Full read/write on project content (files, CRUD tables, ADO config, status). Cannot manage sharing or delete the project.

**Viewer**  
A user the owner has added with view access. Read-only, curated portal view — sees shared files, status, ADO board (filtered), helpful links. No access to internal PM data.

**Org**  
A lightweight namespace for multi-tenant isolation and future billing. Users belong to an org, and all projects live within an org. The org has no privileged owner — it is just a container.

**Example:**  
Bryce creates three projects. He shares two with Mike as Editor and one with Laurel as Editor. A client stakeholder at Company ABC is added to one project as Viewer. When Mike logs in he sees his two projects; Laurel sees her one; the client sees their curated portal. Bryce sees all three because he owns them.

---

## Architecture

```
Next.js 15 App Router (Vercel, Node.js / Fluid Compute)
├── /app/(auth)               — Google sign-in via Firebase Auth
├── /app/(pm)                 — PM + Admin workspace (role-gated)
├── /app/(client)             — Client portal (role-gated)
└── /app/api
    ├── /ado/[projectId]      — ADO REST proxy (PAT never reaches browser)
    └── /files/upload         — Signed URL generation for Firebase Storage

Firebase
├── Auth        — Google OAuth provider only (v1)
├── Firestore   — All structured data
└── Storage     — Context file uploads
```

**Multi-tenancy:** Every Firestore document carries `orgId`. Security rules enforce org isolation at the database level — a compromised client SDK call cannot read another org's data.

**Access enforcement:** Two layers. Firestore security rules check the `members` map on each project document. Next.js middleware gates route groups `(workspace)` and `(portal)` before any page renders.

**Project-level access rules:**
- `owner` — full read/write, can manage sharing, archive, delete
- `editor` — full read/write on project content, cannot manage sharing or delete
- `viewer` — read-only curated portal view

**ADO PAT security:** PATs are AES-256 encrypted before writing to Firestore. The encryption key lives in a Vercel environment variable, never in code. Decryption happens only inside `/api/ado` routes, after verifying the requesting user is an `owner` or `editor` of that project. The decrypted PAT is never logged or returned to the client.

**File security:** Storage paths are prefixed `/{orgId}/{projectId}/`. Rules enforce access via project membership. Downloads use short-lived signed URLs generated server-side — no file is publicly accessible by URL.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router |
| Hosting | Vercel (Fluid Compute, Node.js runtime) |
| Auth | Firebase Auth — Google provider |
| Database | Firestore |
| File Storage | Firebase Storage |
| Styling | Tailwind CSS + shadcn/ui |
| Data fetching | React Query |
| ADO integration | Azure DevOps REST API v7.1 via Next.js API routes |
| Encryption | Node.js `crypto` (AES-256-GCM) |

---

## Data Model (Firestore)

```
orgs/{orgId}
  name, plan, createdAt

orgs/{orgId}/users/{uid}
  email, displayName, createdAt

orgs/{orgId}/projects/{projectId}
  name, description
  techStack: string[]       — e.g. ["React", "Next.js", "Azure"]
  pmTools: string[]         — e.g. ["ADO", "Figma"]
  status: "active" | "archived"
  adoOrgUrl: string         — e.g. "https://dev.azure.com/myorg"
  adoProject: string        — ADO project name
  adoTeam: string           — ADO team name (required for sprint iteration API)
  adoPat: string            — AES-256 encrypted
  members: {                — map of uid → access level
    [uid]: "owner" | "editor" | "viewer"
  }
  sow: {
    startDate, endDate
    totalHours, budgetHours
    summary: string
  }
  statusHeader: {
    scheduleStatus: "on_track" | "at_risk" | "off_track"
    budgetStatus:   "on_track" | "at_risk" | "off_track"
    scopeStatus:    "on_track" | "at_risk" | "off_track"
  }
  createdBy, createdAt, updatedAt

orgs/{orgId}/projects/{projectId}/resources/{id}
  name, role, hours

orgs/{orgId}/projects/{projectId}/files/{fileId}
  name, storagePath, mimeType, sizeBytes
  uploadedBy, uploadedAt
  sharedWithClient: boolean     — false by default

orgs/{orgId}/projects/{projectId}/onboardItems/{id}
  item, owner, description, actionItems: string, complete: boolean

orgs/{orgId}/projects/{projectId}/risks/{id}
  title, owner
  severity: "low" | "medium" | "high"
  description, status: "open" | "resolved"
  createdAt, updatedAt

orgs/{orgId}/projects/{projectId}/issues/{id}
  title, owner
  severity: "low" | "medium" | "high"
  description, status: "open" | "resolved"
  createdAt, updatedAt

orgs/{orgId}/projects/{projectId}/clientActions/{id}
  stakeholderName, description, resolved: boolean
  createdAt

orgs/{orgId}/projects/{projectId}/stakeholders/{id}
  name, role, responsibilities

orgs/{orgId}/projects/{projectId}/helpfulLinks/{id}
  label, url

orgs/{orgId}/projects/{projectId}/roadmapItems/{id}
  title, description, targetDate

orgs/{orgId}/projects/{projectId}/adoCache/{id}
  type: "backlog" | "sprint" | "devplan"
  payload: object             — raw ADO REST response
  fetchedAt                   — TTL: 15 minutes

orgs/{orgId}/projects/{projectId}/statusSnapshots/{id}
  date                        — meeting date (PM-entered)
  schedulePercent: number     — days elapsed / total days at snapshot time
  budgetConsumed: number      — hours logged (manually entered by PM)
  scopeComplete: string       — e.g. "159 / 231"
  notes: string
  adoCacheRef: string         — reference to adoCache doc ID at snapshot time
  createdBy, createdAt
```

---

## ADO Integration

Read-only. All calls go through `/api/ado/[projectId]` which:
1. Verifies the Firebase ID token
2. Confirms the requesting user's uid exists in `project.members` (any access level)
3. Decrypts the PAT
4. Calls the ADO REST API
5. Writes the response to `adoCache` with `fetchedAt`
6. Returns the cached payload to the client

**Cache TTL:** 15 minutes. The client UI shows a "Last synced" timestamp and a manual refresh button that bypasses TTL.

**ADO endpoints consumed:**

| Cache type | ADO endpoint |
|---|---|
| `backlog` | `/{project}/_apis/wit/wiql` — query epics and stories |
| `sprint` | `/{project}/{team}/_apis/work/teamsettings/iterations?$timeframe=current` |
| `devplan` | `/{project}/_apis/work/teamsettings/iterations` + story counts per iteration |

**What PMs and admins see:** All ADO data — full backlog, all iterations, story counts, epic progress.  
**What clients see:** Active sprint board (in-progress and done stories only) + development plan (iteration schedule and milestone dates). No raw backlog.

---

## Workspace — Features

After Google sign-in, every user lands on a dashboard showing projects they own and projects shared with them. No separate admin surface — ownership is per-project, not org-wide.

### Project Dashboard
- All projects where `members[uid]` exists — owned and shared alike
- Status badge, member count, ADO connection indicator, last-updated timestamp
- Create new project (creator becomes `owner`)
- Archive project (owner only)

### Project Workspace (tabbed)

**Overview tab**  
Editable project name, description, tech stack tags, PM tools (owner and editors). Sharing: owner enters any email and picks `editor` or `viewer` → creates user record → sends Firebase Auth invite. Editors land in the full workspace; viewers land in the client portal.

**SOW tab**  
Engagement summary, start/end dates, total hours, budget hours. Resource schedule table: add/edit/remove team members with role and hours.

**Status tab**  
The operational hub. PM sets Schedule / Budget / Scope as ON TRACK / AT RISK / OFF TRACK (color-coded: green / yellow / red). Three metrics displayed alongside the status indicators:
- **Schedule %** — derived from SOW `startDate` / `endDate` (days elapsed / total days). Calculated client-side, no ADO needed.
- **Budget** — hours consumed vs. `sow.budgetHours`. Hours consumed is manually entered by the PM (v1); ADO-sourced actual hours is a v2 integration.
- **Scope** — stories complete vs. total, pulled live from the ADO `backlog` cache.

Below the header: CRUD tables for:
- **Onboard Items** — checklist with owner, description, action items, complete toggle
- **Risks** — severity-badged list (open / resolved)
- **Issues** — severity-badged list (open / resolved)
- **Need From Client** — stakeholder-attributed action items (resolved toggle)

**Status Snapshots**  
PM captures a snapshot before each status meeting. Saves current status header + metrics + notes + reference to the ADO cache at that moment. Builds a historical timeline of project state across all meetings.

**Context Files tab**  
Upload any file type (PDF, DOCX, transcript, image). Per-file toggle: `Share with client`. File list shows name, uploader, upload date, shared status. Internal files are never visible in the client portal.

**ADO Board tab**  
Pulls from ADO cache: epics with story counts, active sprint stories in status columns (To Do / In Progress / Done). Manual refresh button. "Last synced" timestamp shown.

**Development Plan tab**  
Dedicated view of ADO iteration paths, capacity, and story breakdown. Clean table format suitable for presenting to clients.

**Stakeholders tab**  
CRUD table: name, role, responsibilities.

**Helpful Links tab**  
CRUD list of named URLs (KPIs doc, Figma link, Sprint Demos, etc.). These surface in the client portal.

**Roadmap tab**  
CRUD list of future roadmap items with target dates and descriptions.

---

## Client Portal — Features

Intentionally minimal and professional. Clients see only what PMs have surfaced.

### Project Selector
If invited to multiple projects, client sees a simple project picker on login. Otherwise lands directly on their project.

### Project Overview
- Name, description, tech stack (read-only)
- SOW summary: start/end dates, engagement summary
- Status header: Schedule / Budget / Scope indicators (ON TRACK / AT RISK / OFF TRACK)

### Status
- Three metrics: schedule %, budget consumed, scope complete
- "Need From Client" action items (unresolved only)
- Open risks and issues (severity-badged, description only — no internal owner detail)

### Shared Documents
- Only files where `sharedWithClient: true`
- Download only. No upload.

### ADO View
- Active sprint board: in-progress and done stories only
- Development plan: iteration schedule and delivery milestones
- No raw backlog access

### Helpful Links
- All links the PM has added, displayed as a clean link list

---

## Multi-Tenant Onboarding

First Google sign-in → prompted to create a new org (becomes the org's founding member) or enter an org invite code generated by an existing org member. No privileged org role is created — all org members are equal. Project ownership is the only source of elevated access, and it is per-project.

---

## Out of Scope for v1

- AI enrichment of context files (summarization, ADO linking)
- Automated status deck generation (future: data is structured for this)
- Write-back to ADO
- Audit logging / SOC 2 controls
- MFA enforcement
- Self-serve billing / plan management
- Comments or activity feed on project entities

---

## Future State Note

All CRUD-managed data in Orbital (SOW, resources, status header, risks, issues, onboard items, stakeholders, roadmap, helpful links) maps directly to the 40AU status deck template. A v2 feature will auto-generate the status deck PDF/slide from a status snapshot — the data model is designed for this from day one.
