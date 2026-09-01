# Client Portal Redesign — Design Spec
**Date:** 2026-08-31

## Overview

Redesign the client portal (and PM portal) with the FortyAU dark brand identity. Consolidate the Overview and Status tabs into a single scrollable landing page. Add circular progress charts for Schedule and Budget. Keep Milestones, Documents, Links, and Boards as separate tabs.

---

## 1. Theme Architecture

### Approach
Apply a `.orbital` CSS wrapper class to `(pm)/layout.tsx` and `(client)/layout.tsx`. Scope all FortyAU brand CSS variable overrides to `.orbital` in `globals.css`. The `(auth)` layout and root layout are untouched.

### CSS Token Overrides (scoped to `.orbital`)

| Token | Value | Purpose |
|---|---|---|
| `--background` | `#161228` | cosmos — main background |
| `--foreground` | `#f4eeff` | text-1 — primary text |
| `--card` | `#1e1a35` | nebula — elevated surfaces |
| `--card-foreground` | `#f4eeff` | card text |
| `--popover` | `#1e1a35` | popover surface |
| `--popover-foreground` | `#f4eeff` | popover text |
| `--border` | `rgba(255,255,255,0.08)` | standard surface border |
| `--input` | `rgba(255,255,255,0.08)` | input border |
| `--muted` | `#2a2548` | cloud — muted surface |
| `--muted-foreground` | `#bfb3db` | text-2 — secondary text |
| `--primary` | `#fad542` | star gold — primary accent |
| `--primary-foreground` | `#0f0c1a` | void — text on gold |
| `--secondary` | `#2a2548` | cloud |
| `--secondary-foreground` | `#f4eeff` | |
| `--accent` | `#2a2548` | hover surface |
| `--accent-foreground` | `#f4eeff` | |
| `--ring` | `rgba(250,213,66,0.4)` | focus ring in gold |
| `--sidebar` | `#0f0c1a` | void — sidebar |
| `--sidebar-foreground` | `#f4eeff` | |
| `--sidebar-border` | `rgba(255,255,255,0.08)` | |
| `--sidebar-accent` | `#1e1a35` | nebula hover |
| `--sidebar-accent-foreground` | `#f4eeff` | |
| `--sidebar-primary` | `#fad542` | gold active item |
| `--sidebar-primary-foreground` | `#0f0c1a` | |

### Typography
Loaded via `next/font/google` in both `(pm)/layout.tsx` and `(client)/layout.tsx`:
- **Bricolage Grotesque** — weights 200, 400, 600, 700, 800 — used as `--font-sans` override within `.orbital`
- **JetBrains Mono** — weights 400, 500, 700 — used as `--font-mono`
- **Instrument Serif** — italic variant — loaded via `next/font/google`, CSS variable exposed for use in inline italic accent spans

Within `.orbital`, override `--font-sans: 'Bricolage Grotesque'`.

---

## 2. Consolidated Portal Overview Page

### Route
`/portal/[projectId]/overview` — replaces both current Overview and Status pages.

The `portal-project-tabs.tsx` "Status" tab entry is removed. Overview remains the first tab (default landing).

### Layout (single scrollable column, `max-w-3xl`)

#### Project Header
- Project `name` in Bricolage Grotesque, large weight-700
- `description` in muted foreground
- Tech stack as `<Badge variant="secondary">` pills
- Engagement line in JetBrains Mono, muted: `{startDate} → {endDate}`
- SOW summary text below

#### Metrics Row — two equal columns
Each column contains a `CircularProgress` component:

**Schedule circle:**
- Percent: `Math.min(100, round((now - startDate) / (endDate - startDate) * 100))`
- Center: `{n}%` (Bricolage Grotesque 700) + `"elapsed"` sublabel
- Below circle: `StatusBadge` for `scheduleStatus`
- Sub-metric: `"{daysElapsed} of {totalDays} days"`

**Budget circle:**
- Percent: `Math.min(100, round(sum(resources.hours) / sow.totalHours * 100))`
- Center: `{n}%` (Bricolage Grotesque 700) + `"of budget"` sublabel
- Below circle: `StatusBadge` for `budgetStatus`
- Sub-metric: `"{hoursConsumed} of {totalHours} hrs"`
- If `sow.totalHours === 0`: show `—` (guard against division by zero)

#### Open Risks
Section label in JetBrains Mono, uppercase, `--star` gold, with 28px horizontal rule prefix.

Each open risk (`status === 'open'`) rendered as a card (`bg-card`, `border`, `rounded-md`):
- Severity badge: `HIGH` = red bg/text, `MEDIUM` = amber, `LOW` = blue — all on dark card surface
- Title in foreground weight-500
- Description in muted-foreground
- Empty state: `"No open risks."` in muted-foreground

#### Action Required
Only rendered when `unresolvedActions.length > 0`. Same section label pattern.

Each action as a card:
- Stakeholder name in foreground weight-500
- Description in muted-foreground

### Data Fetching
| Data | Hook/Function | Used for |
|---|---|---|
| project | `useProject(orgId, projectId)` | name, description, techStack, sow, statusHeader |
| resources | `useQuery → listResources(orgId, projectId)` | budget % calculation |
| risks | `useQuery → listRisks(orgId, projectId)` | open risks list |
| clientActions | `useQuery → listClientActions(orgId, projectId)` | unresolved actions |

---

## 3. CircularProgress Component

**File:** `components/ui/circular-progress.tsx`

Pure SVG ring chart. No external charting library.

### Props
```ts
interface CircularProgressProps {
  percent: number          // 0–100
  status: StatusLevel      // drives ring color
  size?: number            // default 140
  strokeWidth?: number     // default 10
  children: React.ReactNode // center content
}
```

### Implementation
- SVG viewBox sized to `size × size`
- Background track ring: `stroke="rgba(255,255,255,0.08)"`
- Progress arc: `stroke-dasharray` = circumference, `stroke-dashoffset` = `circumference * (1 - percent/100)`
- Arc color by status: `on_track` → `#fad542` (gold), `at_risk` → `#f59e0b` (amber), `off_track` → `#ef4444` (red)
- `stroke-linecap="round"`, rotated -90° so arc starts at top
- Center content via `<foreignObject>` or absolutely positioned overlay with flexbox

---

## 4. Portal Navigation Restyling

`components/portal/portal-project-tabs.tsx` visual update:
- Tab labels in JetBrains Mono, 11px, uppercase, 0.12em letter-spacing
- Active tab: gold `--star` underline (2px), foreground text
- Inactive: `muted-foreground`
- Background inherits `.orbital` dark surface
- Remove the "Status" tab entry

`components/portal/portal-nav.tsx`:
- Logo/wordmark and user info inherit foreground token (no changes to logic)
- Background inherits `.orbital` dark surface automatically via `bg-background`

---

## 5. PM Portal

The `.orbital` class on `(pm)/layout.tsx` applies the same brand theme to all PM views. No structural changes to PM pages in this spec — the rebrand is purely visual (CSS tokens + fonts).

---

## 6. Out of Scope

- Issues type (sunsetted — not rendered anywhere)
- Scope status (removed from overview page; `scopeStatus` field remains in types but is not displayed)
- Milestones, Documents, Links, Boards pages (inherit brand via `.orbital`, no structural changes)
- Auth pages
- Print/PDF export styling
