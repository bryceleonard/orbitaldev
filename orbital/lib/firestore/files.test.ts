import { vi } from 'vitest'

const mockUpdateDoc = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockDeleteDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  updateDoc: mockUpdateDoc,
  getDocs: mockGetDocs,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('updateFileAiDrafts calls updateDoc with aiDrafts payload', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockUpdateDoc.mockResolvedValue(undefined)
  const { updateFileAiDrafts } = await import('./files')
  const drafts = { decisions: [], milestones: [], risks: [], issues: [] }
  await updateFileAiDrafts('org1', 'proj1', 'file1', drafts)
  expect(mockUpdateDoc).toHaveBeenCalledWith(
    'doc-ref',
    expect.objectContaining({ aiDrafts: drafts }),
  )
})

test('listFiles maps docs with id', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockGetDocs.mockResolvedValue({
    docs: [{ id: 'f1', data: () => ({ name: 'notes.txt', aiStatus: 'ready' }) }],
  })
  const { listFiles } = await import('./files')
  const result = await listFiles('org1', 'proj1')
  expect(result[0]).toEqual({ id: 'f1', name: 'notes.txt', aiStatus: 'ready' })
})
