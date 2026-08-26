import { vi } from 'vitest'

const mockAddDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockQuery = vi.fn()
const mockWhere = vi.fn()
const mockDeleteField = vi.fn(() => 'DELETE_SENTINEL')

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  deleteField: mockDeleteField,
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('createProject sets creator as owner in members map', async () => {
  mockAddDoc.mockResolvedValue({ id: 'proj-1' })
  mockCollection.mockReturnValue('col-ref')
  const { createProject } = await import('./projects')
  const id = await createProject('org1', 'uid-owner', {
    name: 'Test', description: '', techStack: [], pmTools: [],
  })
  expect(id).toBe('proj-1')
  expect(mockAddDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
    members: { 'uid-owner': 'owner' },
    orgId: 'org1',
    status: 'active',
  }))
})

test('addMember merges role into members map via updateDoc', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockUpdateDoc.mockResolvedValue(undefined)
  const { addMember } = await import('./projects')
  await addMember('org1', 'proj-1', 'uid-editor', 'editor')
  expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({
    'members.uid-editor': 'editor',
  }))
})

test('archiveProject sets status to archived', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockUpdateDoc.mockResolvedValue(undefined)
  const { archiveProject } = await import('./projects')
  await archiveProject('org1', 'proj-1')
  expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', { status: 'archived', updatedAt: 'TS' })
})

test('getProject returns null when doc does not exist', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockGetDoc.mockResolvedValue({ exists: () => false })
  const { getProject } = await import('./projects')
  const result = await getProject('org1', 'no-such')
  expect(result).toBeNull()
})

test('createProject stores empty trackerBoards when no firstBoard given', async () => {
  mockAddDoc.mockResolvedValue({ id: 'proj-2' })
  mockCollection.mockReturnValue('col-ref')
  const { createProject } = await import('./projects')
  await createProject('org1', 'uid-owner', {
    name: 'Test', description: '', techStack: [], pmTools: [],
  })
  expect(mockAddDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
    trackerBoards: [],
  }))
})

test('createProject stores firstBoard in trackerBoards', async () => {
  mockAddDoc.mockResolvedValue({ id: 'proj-3' })
  mockCollection.mockReturnValue('col-ref')
  const { createProject } = await import('./projects')
  const board = {
    id: 'b1', label: 'Alpha', type: 'ado' as const,
    adoOrgUrl: '', adoProject: '', adoPat: '',
    adoTeam: '', beadsRepo: '', beadsBranch: 'main',
  }
  await createProject('org1', 'uid-owner', {
    name: 'Test', description: '', techStack: [], pmTools: [],
  }, board)
  expect(mockAddDoc).toHaveBeenCalledWith('col-ref', expect.objectContaining({
    trackerBoards: [board],
  }))
})
