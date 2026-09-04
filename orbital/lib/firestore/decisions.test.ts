import { vi } from 'vitest'

const mockAddDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockUpdateDoc = vi.fn()
const mockDeleteDoc = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  getDocs: mockGetDocs,
  updateDoc: mockUpdateDoc,
  deleteDoc: mockDeleteDoc,
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('listDecisions maps docs to Decision objects with id', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockGetDocs.mockResolvedValue({
    docs: [
      { id: 'd1', data: () => ({ seqId: '001', question: 'Q1', status: 'open' }) },
    ],
  })
  const { listDecisions } = await import('./decisions')
  const result = await listDecisions('org1', 'proj1')
  expect(result).toEqual([{ id: 'd1', seqId: '001', question: 'Q1', status: 'open' }])
  expect(mockCollection).toHaveBeenCalledWith({}, 'orgs/org1/projects/proj1/decisions')
})

test('addDecision returns new doc id', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'new-id' })
  const { addDecision } = await import('./decisions')
  const id = await addDecision('org1', 'proj1', { seqId: '001', question: 'Q?' } as never)
  expect(id).toBe('new-id')
})

test('updateDecision calls updateDoc on the correct path', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockUpdateDoc.mockResolvedValue(undefined)
  const { updateDecision } = await import('./decisions')
  await updateDecision('org1', 'proj1', 'd1', { status: 'decided' })
  expect(mockUpdateDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({ status: 'decided' }))
})

test('deleteDecision calls deleteDoc on the correct path', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockDeleteDoc.mockResolvedValue(undefined)
  const { deleteDecision } = await import('./decisions')
  await deleteDecision('org1', 'proj1', 'd1')
  expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
})
