export type AccessLevel = 'owner' | 'editor' | 'viewer'
export type StatusLevel = 'on_track' | 'at_risk' | 'off_track'
export type Severity = 'low' | 'medium' | 'high'
export type OpenResolved = 'open' | 'resolved'
export type TrackerType = 'ado' | 'beads'

export interface TrackerBoard {
  id: string
  label: string
  type: TrackerType
  adoOrgUrl: string
  adoProject: string
  adoPat?: string       // legacy encrypted field — no longer stored; global ADO_PAT env var is used
  adoTeam: string       // ADO Work Items only; ignored for Beads
  beadsRepo: string     // Beads only: ADO repo name containing .beads/
  beadsBranch: string   // Beads only: defaults to 'main'
}

export interface BeadsDependency {
  depends_on_id: string
  type: string              // 'blocks', 'parent-child', 'waits-for', etc.
}

export interface BeadsComment {
  id?: string
  author: string
  text: string
  created_at?: string
}

export interface BeadsIssue {
  id: string
  title: string
  issue_type: string        // canonical: beads_rust uses issue_type
  type?: string             // legacy alias kept for backward compat
  priority: 0 | 1 | 2 | 3 | 4
  status: string
  assignee: string
  labels: string[]
  description: string
  notes?: string
  design?: string
  dependencies: BeadsDependency[]
  comments: BeadsComment[]
  acceptance_criteria?: string
  parent?: string           // beads_rust: direct parent ID field
  parentId?: string         // normalised: set from parent field or parent-child dep
  created_at?: string
  updated_at?: string
  created_by?: string
}

export interface Org {
  id: string
  name: string
  plan: string
  createdAt: string
}

export interface OrgUser {
  uid: string
  email: string
  displayName: string
  createdAt: string
}

export interface Sow {
  startDate: string
  endDate: string
  totalHours: number
  budgetHours: number
  summary: string
}

export interface StatusHeader {
  scheduleStatus: StatusLevel
  budgetStatus: StatusLevel
  scopeStatus: StatusLevel
}

export interface Project {
  id: string
  orgId: string
  name: string
  description: string
  techStack: string[]
  pmTools: string[]
  status: 'active' | 'archived'
  trackerBoards: TrackerBoard[]
  members: Record<string, AccessLevel>
  sow: Sow
  statusHeader: StatusHeader
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface Resource {
  id: string
  name: string
  role: string
  hours: number
}

export interface ProjectFile {
  id: string
  name: string
  storagePath: string
  mimeType: string
  sizeBytes: number
  uploadedBy: string
  uploadedAt: string
  sharedWithClient: boolean
}

export interface OnboardItem {
  id: string
  item: string
  owner: string
  description: string
  actionItems: string
  complete: boolean
}

export interface Risk {
  id: string
  title: string
  owner: string
  severity: Severity
  description: string
  status: OpenResolved
  createdAt: string
  updatedAt: string
}

export interface Issue {
  id: string
  title: string
  owner: string
  severity: Severity
  description: string
  status: OpenResolved
  createdAt: string
  updatedAt: string
}

export interface ClientAction {
  id: string
  stakeholderName: string
  description: string
  resolved: boolean
  createdAt: string
}

export interface Stakeholder {
  id: string
  name: string
  role: string
  responsibilities: string
}

export interface HelpfulLink {
  id: string
  label: string
  url: string
}

export interface RoadmapItem {
  id: string
  title: string
  description: string
  targetDate: string
}

export interface AdoCache {
  id: string
  boardId: string       // which TrackerBoard this cache entry belongs to
  type: 'backlog' | 'sprint' | 'devplan' | 'beads-issues'
  payload: Record<string, unknown>
  fetchedAt: string
}

export interface StatusSnapshot {
  id: string
  date: string
  schedulePercent: number
  budgetConsumed: number
  scopeComplete: string
  notes: string
  adoCacheRef: string
  createdBy: string
  createdAt: string
}
