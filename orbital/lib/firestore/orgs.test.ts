import { vi } from 'vitest'

const mockAddDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockGetDocs = vi.fn()
const mockCollection = vi.fn()
const mockDoc = vi.fn()
const mockQuery = vi.fn()

vi.mock('firebase/firestore', () => ({
  collection: mockCollection,
  doc: mockDoc,
  addDoc: mockAddDoc,
  setDoc: mockSetDoc,
  getDocs: mockGetDocs,
  query: mockQuery,
  serverTimestamp: vi.fn(() => 'TIMESTAMP'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))
vi.mock('./users', () => ({ setUserOrg: vi.fn().mockResolvedValue(undefined) }))

beforeEach(() => vi.clearAllMocks())

test('createOrg creates org doc, creates user doc, returns orgId', async () => {
  mockAddDoc.mockResolvedValue({ id: 'org-abc' })
  mockCollection.mockReturnValue('col-ref')
  mockDoc.mockReturnValue('doc-ref')
  mockSetDoc.mockResolvedValue(undefined)

  const { createOrg } = await import('./orgs')
  const orgId = await createOrg('FortyAU', 'uid1', 'b@test.com', 'Bryce')

  expect(orgId).toBe('org-abc')
  expect(mockAddDoc).toHaveBeenCalledOnce()
  expect(mockSetDoc).toHaveBeenCalledOnce()
})

test('joinOrg writes user doc into existing org', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockSetDoc.mockResolvedValue(undefined)

  const { joinOrg } = await import('./orgs')
  await joinOrg('org-xyz', 'uid2', 'm@test.com', 'Mike')

  expect(mockSetDoc).toHaveBeenCalledWith(
    'doc-ref',
    expect.objectContaining({ uid: 'uid2', email: 'm@test.com' })
  )
})

test('orgExists returns false when org has no users', async () => {
  mockGetDocs.mockResolvedValue({ empty: true, docs: [] })
  mockQuery.mockReturnValue('q-ref')
  mockCollection.mockReturnValue('col-ref')

  const { orgExists } = await import('./orgs')
  const result = await orgExists('no-such-org')
  expect(result).toBe(false)
})

test('orgExists returns true when org has users', async () => {
  mockGetDocs.mockResolvedValue({ empty: false, docs: [{}] })
  mockQuery.mockReturnValue('q-ref')
  mockCollection.mockReturnValue('col-ref')

  const { orgExists } = await import('./orgs')
  const result = await orgExists('existing-org')
  expect(result).toBe(true)
})
