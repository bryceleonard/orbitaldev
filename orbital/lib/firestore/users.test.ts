import { vi } from 'vitest'

const mockSetDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockDoc = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  serverTimestamp: vi.fn(() => 'TS'),
}))
vi.mock('@/lib/firebase/client', () => ({ db: {} }))

beforeEach(() => vi.clearAllMocks())

test('setUserOrg writes orgId to users/{uid}', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockSetDoc.mockResolvedValue(undefined)
  const { setUserOrg } = await import('./users')
  await setUserOrg('uid1', 'org-abc')
  expect(mockSetDoc).toHaveBeenCalledWith('doc-ref', expect.objectContaining({ orgId: 'org-abc' }))
})

test('getUserOrgId returns null when doc does not exist', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockGetDoc.mockResolvedValue({ exists: () => false })
  const { getUserOrgId } = await import('./users')
  const result = await getUserOrgId('uid-nobody')
  expect(result).toBeNull()
})

test('getUserOrgId returns orgId when doc exists', async () => {
  mockDoc.mockReturnValue('doc-ref')
  mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ orgId: 'org-xyz' }) })
  const { getUserOrgId } = await import('./users')
  const result = await getUserOrgId('uid1')
  expect(result).toBe('org-xyz')
})
