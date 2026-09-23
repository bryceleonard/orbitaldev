# Firestore Data Model

## Collections

### `orgs/{orgId}/projects/{projectId}/milestones/{milestoneId}`

Stores milestone definitions for a project.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `string` | Document ID |
| `name` | `string` | Required. Display name. |
| `status` | `MilestoneStatus` | Required. One of: backlog, not_started, in_progress, blocked, completed. |
| `description` | `string?` | Markdown. Optional on all milestones. |
| `startDate` | `string?` | Required for non-backlog milestones |
| `endDate` | `string?` | Required for non-backlog milestones |
| `history` | `MilestoneHistoryEntry[]` | Status transition log. |
| `createdAt` | `Timestamp` | Server-set. |
| `updatedAt` | `Timestamp` | Server-set; updated on any change. |
| `createdBy` | `string` | UID of creator. |

## Global Types

```typescript
type MilestoneStatus = 'backlog' | 'not_started' | 'in_progress' | 'blocked' | 'completed'

interface MilestoneHistoryEntry {
  timestamp: string
  fromStatus: MilestoneStatus | null
  toStatus: MilestoneStatus
}

interface Milestone {
  id: string
  name: string
  status: MilestoneStatus
  startDate?: string
  endDate?: string
  description?: string
  history: MilestoneHistoryEntry[]
  createdAt: string
  updatedAt: string
  createdBy: string
}
```
