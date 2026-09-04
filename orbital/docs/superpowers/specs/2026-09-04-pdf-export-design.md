# PDF Export — Client Portal Report

**Date:** 2026-09-04
**Status:** Approved

## Problem

The client portal overview is designed for screens. Circular progress rings, velocity charts, and tab navigation do not translate to print. The previous `window.print()` of the existing page produced poor output. A dedicated print-optimized layout is needed.

## Solution

A separate report route (`/portal/[projectId]/report`) designed for paper from day one. The existing interactive portal is unchanged. Users access the report via an "Export PDF" button in the portal tabs, which opens the route in a new tab.

## Scope

Includes all content currently on the portal overview tab:
- Project header
- Schedule and Budget metrics
- Open risks
- Milestones

Excludes: Documents, Links, Velocity chart (no meaning without interactivity).

## Route

`app/(client)/portal/[projectId]/report/page.tsx`

- Client component (requires hooks for data fetching)
- Fetches: project, risks, milestones, beads cache (same queries as overview)
- Injects `<style>{ @page { size: A4; margin: 20mm; } }</style>` for paper sizing
- White background, clean typography — readable as a report preview on screen before printing

## Sections (in order)

### 1. Header Band
- Left: "FortyAU" wordmark (bold, dark)
- Center: "Project Status Report" label
- Right: Generated date (formatted, e.g. "September 4, 2026")
- Thin bottom border separating it from content

### 2. Project Block
- Project name (large, heavy weight)
- Description (if present)
- Tech stack as small pill badges
- Date range in monospace (`startDate → endDate`)
- SOW summary paragraph (if present)

### 3. Metrics Row
Two side-by-side blocks — Schedule and Budget.

Each block contains:
- Label (uppercase, small)
- Large percentage number
- Filled horizontal progress bar (replaces circular ring)
- Status text: "On Track" / "At Risk" / "Off Track" (color-coded)
- Detail line: e.g. "47 of 120 days" or "60 of 120 hrs"

Velocity is excluded — bar charts require interactive context.

### 4. Risks
Table format: Severity | Title | Description

- Only open risks
- Severity shown as a styled badge (Low / Medium / High)
- If no open risks: single "No open risks." line

Page break forced before this section.

### 5. Milestones
Table format: Milestone | Status | Start | End

- Sorted by start date
- Status shown as a styled badge
- Gantt chart excluded (SVG-based, breaks across pages poorly)

Page break forced before this section.

### Footer
`Confidential · Generated [date] · Orbital`

Rendered as a fixed bottom element with `print:block hidden` so it only shows when printing, or as a CSS `@page` margin box if feasible.

## Trigger & Navigation

- `portal-project-tabs.tsx`: Add "Export PDF" button, right-aligned, visually distinct from tab links. Opens `/portal/[projectId]/report` in a new tab (`target="_blank"`).
- Report page: Sticky "Print" button at top of page content, `print:hidden`. User reviews report before printing, then clicks Print (or Cmd+P). No auto-trigger on load.

## What Changes

| File | Change |
|---|---|
| `app/(client)/portal/[projectId]/report/page.tsx` | New file — report page |
| `components/portal/portal-project-tabs.tsx` | Add "Export PDF" button |

No changes to the existing overview page or any other portal pages.

## Not In Scope

- Server-side PDF generation (puppeteer, `@react-pdf/renderer`) — too complex for current needs
- Print CSS on the existing overview page — the screen layout is fundamentally incompatible with paper
- Auto-triggering `window.print()` on load — user should review before printing
