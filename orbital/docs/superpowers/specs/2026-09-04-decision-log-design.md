# Decision Log

**Date:** 2026-09-04
**Status:** Approved

## Problem

Decisions made during a project are tracked in a spreadsheet outside Orbital. There is no structured way to capture who is responsible and accountable, when a decision is due, and what the final outcome was. The Excel sheet in use has the right structure; Orbital needs to replace it.

## Solution

A per-project Decision Log: a new PM-only tab with a summary bar and a full CRUD table. Full RACI fields, status lifecycle, date tracking, and a manual revisit counter. No portal exposure in v1. No separate revisit audit log — a `timesRevisited` counter is sufficient.

## Scope

PM-only. No portal changes. No client visibility.

## Data Model

New Firestore subcollection: `orgs/{orgId}/projects/{projectId}/decisions`

New types in `lib/types.ts`:

```typescript
export type DecisionStatus = 'open' | 'pending_input' | 'decided' | 'revisit_requested' | 'closed'

export interface Decision {
  id: string
  seqId: string            // zero-padded sequential: "001", "002"
  question: string         // Decision / Question to Be Decided
  background: string       // Background / Context
  responsible: string      // R — does the analysis, drives to recommendation
  accountable: string      // A — single person with final call
  consulted: string        // C — input sought before deciding (two-way)
  informed: string         // I — told after decision is made (one-way)
  priority: 'low' | 'medium' | 'high'
  status: DecisionStatus
  dateIdentified: string   // YYYY-MM-DD
  dueDate: string          // YYYY-MM-DD
  dateDecided: string      // YYYY-MM-DD — set when status transitions to 'decided'
  outcome: string          // Decision Made / Outcome
  timesRevisited: number   // PM increments manually when reopening a decided item
  notes: string
  createdAt: string
  updatedAt: string
  createdBy: string
}
```

`seqId` is assigned at creation by reading `decisions.length + 1` from the current list, zero-padded to 3 digits. Days Until Due and overdue state are computed client-side from `dueDate`.

## Files

| File | Change |
|---|---|
| `lib/types.ts` | Add `DecisionStatus` and `Decision` |
| `lib/firestore/decisions.ts` | New — CRUD functions |
| `app/(pm)/projects/[projectId]/decisions/page.tsx` | New — PM decisions page |
| `components/layout/project-tabs.tsx` | Add "Decisions" tab after "Status" |
| `components/tables/crud-table.tsx` | Add `date` and `number` column types |

## CrudTable Extensions

`ColumnDef.type` must support two new values:

- `'date'` — renders `<input type="date" />` in edit mode, displays the value as-is in read mode
- `'number'` — renders `<input type="number" min={0} />` in edit mode, displays the value in read mode

The `emptyDraft` default for `number` is `0`; for `date` it is `''`.

## UI

### Tab placement

"Decisions" inserted after "Status" in `STATIC_BEFORE` in `project-tabs.tsx`.

### Summary bar

Thin row of labeled count badges at the top of the page. Counts computed from the full decisions list client-side:

- **Open** — status = 'open'
- **Pending Input** — status = 'pending_input'
- **Decided** — status = 'decided'
- **Revisit Requested** — status = 'revisit_requested'
- **Overdue** — status not 'decided' or 'closed', dueDate < today
- **Due within 7 days** — status not 'decided' or 'closed', dueDate within next 7 days

### Table

Uses the existing `CrudTable` component with inline editing.

**Display columns** (shown in non-edit rows):
| Column | Source | Notes |
|---|---|---|
| ID | `seqId` | Displayed as zero-padded string, e.g. "001" |
| Question | `question` | Truncated if long |
| Priority | `priority` | Colored badge: low=blue, medium=amber, high=red |
| Status | `status` | Colored badge |
| Due Date | `dueDate` | |
| Days Until Due | computed | Red when negative (overdue); blank when decided/closed |

**Edit mode fields** (all fields, in order):
1. Question (text)
2. Background / Context (textarea)
3. Responsible — R (text)
4. Accountable — A (text)
5. Consulted — C (text)
6. Informed — I (text)
7. Priority (select: low / medium / high)
8. Status (select: open / pending_input / decided / revisit_requested / closed)
9. Date Identified (date input)
10. Due Date (date input)
11. Date Decided (date input — auto-filled with today when status transitions to 'decided' and field is empty)
12. Outcome (textarea)
13. Times Revisited (number input)
14. Notes (textarea)

### New decision defaults

When the PM adds a new row:
- `status: 'open'`
- `dateIdentified: today` (YYYY-MM-DD)
- `timesRevisited: 0`
- All other fields empty

### Status badge colors

| Status | Style |
|---|---|
| open | amber |
| pending_input | blue |
| decided | green |
| revisit_requested | red |
| closed | gray |

## Not In Scope

- Portal/client visibility
- Revisit audit log subcollection
- Decision ID with project-name prefix (seqId is sufficient for v1)
- Filtering or sorting by column
- Export to PDF (the report page doesn't include decisions yet)
