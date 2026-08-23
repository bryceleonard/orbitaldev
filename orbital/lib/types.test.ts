import type {
  Org, OrgUser, Project, AccessLevel,
  Resource, ProjectFile, OnboardItem,
  Risk, Issue, ClientAction, Stakeholder,
  HelpfulLink, RoadmapItem, AdoCache, StatusSnapshot,
  StatusLevel, Severity,
} from '@/lib/types'

test('AccessLevel values compile', () => {
  const level: AccessLevel = 'owner'
  expect(level).toBe('owner')
})

test('StatusLevel values compile', () => {
  const status: StatusLevel = 'on_track'
  expect(status).toBe('on_track')
})

test('Project members map accepts uid keys with AccessLevel values', () => {
  const members: Project['members'] = { uid123: 'editor', uid456: 'viewer' }
  expect(members['uid123']).toBe('editor')
})

test('StatusHeader uses StatusLevel for all three fields', () => {
  const header: Project['statusHeader'] = {
    scheduleStatus: 'on_track',
    budgetStatus: 'at_risk',
    scopeStatus: 'off_track',
  }
  expect(header.budgetStatus).toBe('at_risk')
})
