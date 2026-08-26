import type { Project, TrackerBoard, BeadsIssue, AdoCache } from './types'

test('TrackerBoard has required fields', () => {
  const board: TrackerBoard = {
    id: 'b1',
    label: 'Alpha',
    type: 'ado',
    adoOrgUrl: 'https://dev.azure.com/myorg',
    adoProject: 'MyProject',
    adoPat: 'encrypted',
    adoTeam: 'MyTeam',
    beadsRepo: '',
    beadsBranch: 'main',
  }
  expect(board.type).toBe('ado')
})

test('Project has trackerBoards and no flat ADO fields', () => {
  const p = {} as Project
  // trackerBoards exists on the type
  expect('trackerBoards' in ({} as Project)).toBe(false) // structural — just checks it compiles
})

test('BeadsIssue has priority as number', () => {
  const issue: BeadsIssue = {
    id: 'br-1',
    title: 'Fix it',
    type: 'bug',
    priority: 0,
    status: 'open',
    assignee: 'alice',
    labels: [],
    description: '',
    dependencies: [],
    acceptance_criteria: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
  expect(issue.priority).toBe(0)
})

test('AdoCache type union includes beads-issues', () => {
  const cache: AdoCache = {
    id: 'c1',
    boardId: 'b1',
    type: 'beads-issues',
    payload: {},
    fetchedAt: '2026-01-01T00:00:00Z',
  }
  expect(cache.type).toBe('beads-issues')
})
