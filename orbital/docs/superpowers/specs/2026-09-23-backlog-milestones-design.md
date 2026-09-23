# Backlog Status & Description for Milestones

**Date:** 2026-09-23

## Overview

Milestones gain a `backlog` status and a markdown `description` field. A backlog item is simply an unscheduled milestone — it has a name and description but no dates. Once dates are added and the status is changed, it becomes a scheduled milestone. The Gantt excludes backlog items. The milestones page gains a dedicated backlog section.

## Data Model

### `MilestoneStatus` (`lib/types.ts`)

Add `'backlog'` to the union:

```ts
type MilestoneStatus = 'backlog' | 'not_started' | 'in_progress' | 'blocked' | 'completed'
```

### `Milestone` (`lib/types.ts`)

- Add `description?: string` — markdown text, optional on all milestones
- Make `startDate?: string` and `endDate?: string` optional — backlog items have no dates

### Firestore schema update (`docs/firestore-data-model.md`)

Add to the `milestones/{milestoneId}` table:

| Field | Type | Notes |
|---|---|---|
| `description` | `string?` | Markdown. Optional. |
| `startDate` | `string?` | Required for non-backlog milestones |
| `endDate` | `string?` | Required for non-backlog milestones |

## Firestore Layer (`lib/firestore/milestones.ts`)

### `addMilestone`

New signature:

```ts
addMilestone(
  orgId: string,
  projectId: string,
  data: {
    name: string
    status: MilestoneStatus
    startDate?: string
    endDate?: string
    description?: string
    createdBy: string
  }
): Promise<string>
```

- Caller sets `status: 'backlog'` for backlog items (no dates required)
- Caller sets `status: 'not_started'` for scheduled milestones (dates provided)

### `updateMilestone`

Extend to accept `description?: string` alongside the existing optional `name`, `startDate`, `endDate`.

## Components

### `MilestonesGantt` (`components/milestones/milestones-gantt.tsx`)

Filter input before rendering:

```ts
const scheduled = milestones.filter(m => m.status !== 'backlog')
```

Pass `scheduled` to the existing chart. No other changes.

### `MarkdownBody` (`components/ui/markdown-body.tsx`)

New shared component. Thin wrapper around `react-markdown` with `@tailwindcss/typography` prose classes applied. Used wherever markdown is rendered in the app.

### `BacklogItemCard` (`components/milestones/backlog-item-card.tsx`)

New component. Renders a single backlog item:

- Name as heading
- `MarkdownBody` for the description
- Edit button (canEdit): opens inline form with name + markdown textarea + optional date fields
- Delete button (canEdit)
- Status dropdown: only `'backlog'` is available until both `startDate` and `endDate` are filled — at that point all statuses unlock. Changing off `'backlog'` requires dates; if dates are absent the dropdown resets and shows an inline message: "Add start and end dates before scheduling."

### `MilestonesManager` (`components/milestones/milestones-manager.tsx`)

Updated props:

```ts
interface Props {
  milestones: Milestone[]
  canEdit: boolean
  onAddMilestone: (data: { name: string; startDate: string; endDate: string }) => Promise<void>
  onAddBacklog: (data: { name: string; description?: string }) => Promise<void>
  onStatusChange: (milestone: Milestone, newStatus: MilestoneStatus) => Promise<void>
  onUpdate: (id: string, data: { name: string; startDate?: string; endDate?: string; description?: string }) => Promise<void>
  onDelete: (id: string) => Promise<void>
}
```

Internally splits `milestones` into two arrays:

```ts
const backlog = milestones.filter(m => m.status === 'backlog')
const scheduled = milestones.filter(m => m.status !== 'backlog').sort(...)
```

Renders:

1. **Milestones** heading + "Add milestone" button + existing scheduled list (dates required, description textarea optional in edit form)
2. **Backlog** heading + "Add backlog item" button + list of `BacklogItemCard`

Status dropdown on scheduled milestones includes `'backlog'` as a demotion option (no date-clearing needed — dates remain stored but are ignored while in backlog).

### `MilestonesPage` (`app/(pm)/projects/[projectId]/milestones/page.tsx`)

Replace single `handleAdd` with:

```ts
async function handleAddMilestone(data: { name: string; startDate: string; endDate: string }) {
  await addMilestone(orgId!, projectId, { ...data, status: 'not_started', createdBy: user!.uid })
  await inv()
}

async function handleAddBacklog(data: { name: string; description?: string }) {
  await addMilestone(orgId!, projectId, { ...data, status: 'backlog', createdBy: user!.uid })
  await inv()
}
```

Pass both to `MilestonesManager`. Pass `handleUpdate` updated to include `description?`.

## Page Layout

```
[Timeline / Gantt]         ← scheduled milestones only, hidden if none
[Milestones section]       ← scheduled list, existing UI
[Backlog section]          ← new, backlog cards with markdown descriptions
```

## Dependencies to Install

```
react-markdown
@tailwindcss/typography
```

`@tailwindcss/typography` requires adding `typography` to the `plugins` array in `tailwind.config.ts` (or equivalent).

## Constraints

- Dates are never deleted when demoting to backlog — stored values are preserved and reappear if the item is rescheduled
- `description` is optional on scheduled milestones too — PMs may add notes to any milestone
- No rich-text editor — plain textarea for input, `react-markdown` for rendered output
- Firestore security rules unchanged — existing editor/viewer ACL applies
