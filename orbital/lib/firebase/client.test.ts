import { vi } from 'vitest'

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
  getApps: vi.fn(() => []),
}))
vi.mock('firebase/auth', () => ({ getAuth: vi.fn(() => ({ type: 'auth' })) }))
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(() => ({ type: 'db' })) }))
vi.mock('firebase/storage', () => ({ getStorage: vi.fn(() => ({ type: 'storage' })) }))

test('exports auth, db, and storage', async () => {
  const { auth, db, storage } = await import('./client')
  expect(auth).toBeDefined()
  expect(db).toBeDefined()
  expect(storage).toBeDefined()
})
