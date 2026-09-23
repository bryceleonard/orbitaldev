# Firestore Data Model

## Root Collections

### `users/{uid}`
| Field | Type | Notes |
|---|---|---|
| `orgId` | `string` | The user's primary organization |
| `updatedAt` | `Timestamp` | |

### `orgs/{orgId}`
| Field | Type |
|---|---|
| `id` | `string` |
| `name` | `string` |
| `plan` | `string` |
| `createdAt` | `Timestamp` |

### `orgs/{orgId}/users/{uid}`
| Field | Type |
|---|---|
| `uid` | `string` |
| `email` | `string` |
| `displayName` | `string` |
| `createdAt` | `Timestamp` |

---

## Projects

### `orgs/{orgId}/projects/{projectId}`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `orgId` | `string` | |
| `name` | `string` | |
| `description` | `string` | |
| `techStack` | `string[]` | |
| `pmTools` | `string[]` | |
| `status` | `'active' \| 'archived'` | |
| `trackerBoards` | `TrackerBoard[]` | Embedded array — see below |
| `members` | `Record<uid, AccessLevel>` | `'owner' \| 'editor' \| 'viewer'` — used for access control |
| `sow.startDate` | `string` | |
| `sow.endDate` | `string` | |
| `sow.totalHours` | `number` | |
| `sow.summary` | `string` | |
| `statusHeader.scheduleStatus` | `StatusLevel` | `'on_track' \| 'at_risk' \| 'off_track'` |
| `statusHeader.budgetStatus` | `StatusLevel` | |
| `statusHeader.scopeStatus` | `StatusLevel` | |
| `createdBy` | `string` | uid |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | |

#### TrackerBoard (embedded in project)

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `label` | `string` | Display name |
| `type` | `'ado' \| 'beads'` | |
| `adoOrgUrl` | `string` | ADO only |
| `adoProject` | `string` | ADO only |
| `adoTeam` | `string` | ADO only |
| `beadsRepo` | `string` | Beads only |
| `beadsBranch` | `string` | Beads only, defaults to `'main'` |

---

## Project Subcollections

All paths are relative to `orgs/{orgId}/projects/{projectId}/`.

### `milestones/{milestoneId}`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `name` | `string` | |
| `status` | `MilestoneStatus` | `'backlog'` items have no dates |
| `description` | `string?` | Markdown. Optional on all milestones. |
| `startDate` | `string?` | Required for non-backlog milestones |
| `endDate` | `string?` | Required for non-backlog milestones |
| `history` | `MilestoneHistoryEntry[]` | Status change audit trail |
| `createdBy` | `string` | uid |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | |

**MilestoneHistoryEntry**

| Field | Type |
|---|---|
| `timestamp` | `string` |
| `fromStatus` | `MilestoneStatus \| null` |
| `toStatus` | `MilestoneStatus` |

### `risks/{riskId}`

| Field | Type |
|---|---|
| `id` | `string` |
| `title` | `string` |
| `severity` | `'low' \| 'medium' \| 'high'` |
| `status` | `'open' \| 'resolved'` |
| `description` | `string` |
| `owner` | `string` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

> `issues/{issueId}` has the same shape but is sunsetted. Risks is the active collection.

### `resources/{resourceId}`

| Field | Type |
|---|---|
| `id` | `string` |
| `name` | `string` |
| `role` | `string` |
| `hours` | `number` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

### `files/{fileId}`

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `name` | `string` | Display filename |
| `storagePath` | `string` | Firebase Storage path |
| `mimeType` | `string` | |
| `sizeBytes` | `number` | |
| `uploadedBy` | `string` | uid |
| `uploadedAt` | `string` | |
| `sharedWithClient` | `boolean` | Controls portal visibility |
| `createdAt` | `Timestamp` | |
| `updatedAt` | `Timestamp` | |

### `clientActions/{clientActionId}`

| Field | Type |
|---|---|
| `id` | `string` |
| `stakeholderName` | `string` |
| `description` | `string` |
| `resolved` | `boolean` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

### `stakeholders/{stakeholderId}`

| Field | Type |
|---|---|
| `id` | `string` |
| `name` | `string` |
| `role` | `string` |
| `responsibilities` | `string` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

### `helpfulLinks/{linkId}`

| Field | Type |
|---|---|
| `id` | `string` |
| `label` | `string` |
| `url` | `string` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

### `onboardItems/{onboardItemId}`

| Field | Type |
|---|---|
| `id` | `string` |
| `item` | `string` |
| `owner` | `string` |
| `description` | `string` |
| `actionItems` | `string` |
| `complete` | `boolean` |
| `createdAt` | `Timestamp` |
| `updatedAt` | `Timestamp` |

### `adoCache/{cacheId}`

Stores the most recent fetched payload for each board. Used for both ADO and Beads boards. TTL is 15 minutes — see [Beads storage](#beads-storage) below.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `boardId` | `string` | References `TrackerBoard.id` on the project |
| `type` | `'backlog' \| 'sprint' \| 'devplan' \| 'beads-issues'` | |
| `payload` | `unknown` | Raw parsed data from ADO or Beads |
| `fetchedAt` | `Timestamp` | Used to evaluate TTL |

---

## Beads Storage

Beads data is **not stored in its own Firestore collection**. It is fetched live and transiently cached in `adoCache`, the same subcollection used for ADO boards.

**Flow:**

1. A board page load calls `/api/boards/[projectId]/[boardId]?type=beads-issues`
2. The API checks `adoCache` for a `beads-issues` entry for that `boardId` less than 15 minutes old
3. If a warm cache entry exists, it is returned immediately (`fromCache: true`)
4. If the cache is cold or `?force=1` is passed, the API fetches the JSONL file from the configured `beadsRepo`/`beadsBranch` via the ADO/GitHub API, parses it into `BeadsIssue[]`, writes it to `adoCache`, and returns the fresh data

**Nothing is permanently stored.** There is no sync job and no dedicated Beads collection — only the rolling 15-minute cache entry in `adoCache`:

```
adoCache/{docId}
  boardId:   string          // which TrackerBoard this belongs to
  type:      'beads-issues'  // distinguishes from ADO cache types
  payload:   BeadsIssue[]    // parsed JSONL, full issue objects
  fetchedAt: Timestamp       // used to check TTL
```

---

## Security Model

- All reads and writes require authentication (`isSignedIn()`)
- Project reads require the uid to be present in `project.members`
- Subcollection writes require `owner` or `editor` role
- Subcollection deletes require `owner` or `editor` role
- Project deletes require `owner` role
- Org-level documents are read-only after creation

## Global Types

```typescript
type AccessLevel    = 'owner' | 'editor' | 'viewer'
type StatusLevel    = 'on_track' | 'at_risk' | 'off_track'
type Severity       = 'low' | 'medium' | 'high'
type MilestoneStatus = 'backlog' | 'not_started' | 'in_progress' | 'blocked' | 'completed'
type TrackerType    = 'ado' | 'beads'
```
