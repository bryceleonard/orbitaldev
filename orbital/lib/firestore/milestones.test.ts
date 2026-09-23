import { vi } from 'vitest'

const mockAddDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockUpdateDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockArrayUnion = vi.fn((entry) => [entry])

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: vi.fn(() => 'TS'),
  arrayUnion: mockArrayUnion,
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('addMilestone with backlog status stores no dates', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'new-id' })
  const { addMilestone } = await import('./milestones')
  const id = await addMilestone('org1', 'proj1', { name: 'Idea', status: 'backlog', createdBy: 'uid1' })
  expect(id).toBe('new-id')
  const payload = mockAddDoc.mock.calls[0][1]
  expect(payload.name).toBe('Idea')
  expect(payload.status).toBe('backlog')
  expect(payload.startDate).toBeUndefined()
  expect(payload.endDate).toBeUndefined()
})

test('addMilestone with not_started status stores dates', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'ms-id' })
  const { addMilestone } = await import('./milestones')
  await addMilestone('org1', 'proj1', {
    name: 'Ship v1',
    status: 'not_started',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    createdBy: 'uid1',
  })
  const payload = mockAddDoc.mock.calls[0][1]
  expect(payload.startDate).toBe('2026-10-01')
  expect(payload.endDate).toBe('2026-10-31')
})

test('addMilestone stores description when provided', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'id1' })
  const { addMilestone } = await import('./milestones')
  await addMilestone('org1', 'proj1', {
    name: 'Spike',
    status: 'backlog',
    description: '## Goals\n\nDefine scope.',
    createdBy: 'uid1',
  })
  const payload = mockAddDoc.mock.calls[0][1]
  expect(payload.description).toBe('## Goals\n\nDefine scope.')
})

test('updateMilestone passes description to Firestore', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockUpdateDoc.mockResolvedValue(undefined)
  const { updateMilestone } = await import('./milestones')
  await updateMilestone('org1', 'proj1', 'ms-1', { description: '## Updated\n\nNew notes.' })
  const payload = mockUpdateDoc.mock.calls[0][1]
  expect(payload.description).toBe('## Updated\n\nNew notes.')
  expect(payload.updatedAt).toBe('TS')
})
