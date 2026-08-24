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

test('listItems maps docs to objects with id', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockGetDocs.mockResolvedValue({
    docs: [
      { id: 'doc1', data: () => ({ title: 'A' }) },
      { id: 'doc2', data: () => ({ title: 'B' }) },
    ],
  })
  const { listItems } = await import('./subcollection')
  const result = await listItems('orgs/o1/projects/p1/risks')
  expect(result).toEqual([{ id: 'doc1', title: 'A' }, { id: 'doc2', title: 'B' }])
})

test('addItem returns new doc id', async () => {
  mockCollection.mockReturnValue('col-ref')
  mockAddDoc.mockResolvedValue({ id: 'new-id' })
  const { addItem } = await import('./subcollection')
  const id = await addItem('orgs/o1/projects/p1/risks', { title: 'Risk A' })
  expect(id).toBe('new-id')
})

test('deleteItem calls deleteDoc', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockDeleteDoc.mockResolvedValue(undefined)
  const { deleteItem } = await import('./subcollection')
  await deleteItem('orgs/o1/projects/p1/risks', 'risk-1')
  expect(mockDeleteDoc).toHaveBeenCalledWith('doc-ref')
})
