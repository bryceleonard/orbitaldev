export type AccessLevel = 'owner' | 'editor' | 'viewer'
export type StatusLevel = 'on_track' | 'at_risk' | 'off_track'
export type Severity = 'low' | 'medium' | 'high'
export type OpenResolved = 'open' | 'resolved'

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
  adoOrgUrl: string
  adoProject: string
  adoTeam: string
  adoPat: string          // AES-256-GCM encrypted at rest
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
  type: 'backlog' | 'sprint' | 'devplan'
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
