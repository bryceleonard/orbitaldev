import { vi, test, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockVerifySessionCookie = vi.fn()
const mockGetDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockGetDocs = vi.fn()

vi.mock('@/lib/firebase/admin', () => ({
  adminAuth: { verifySessionCookie: mockVerifySessionCookie },
  adminDb: {
    doc: vi.fn((path: string) => ({
      path,
      get: mockGetDoc,
    })),
    collection: vi.fn((path: string) => ({
      path,
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: mockGetDocs,
          })),
        })),
      })),
      doc: vi.fn(() => ({
        set: mockSetDoc,
        id: 'new-cache-id',
      })),
      get: mockGetDocs,
    })),
  },
}))
vi.mock('@/lib/ado/encryption', () => ({ decryptPat: vi.fn(() => 'decrypted-pat') }))
vi.mock('@/lib/ado/client', () => ({
  fetchBacklog: vi.fn().mockResolvedValue({ value: [{ id: 1, title: 'Epic A' }] }),
  fetchSprint: vi.fn().mockResolvedValue({ value: [] }),
  fetchDevPlan: vi.fn().mockResolvedValue({ value: [] }),
}))

beforeEach(() => vi.clearAllMocks())

const PROJECT_DATA = {
  orgId: 'org1',
  adoOrgUrl: 'https://dev.azure.com/myorg',
  adoProject: 'MyProject',
  adoTeam: 'MyTeam',
  adoPat: 'iv:tag:cipher',
  members: { 'uid-owner': 'owner' },
}

function makeReq(projectId: string, type: string, cookie?: string) {
  const url = `http://localhost/api/ado/${projectId}?type=${type}`
  const headers = new Headers()
  if (cookie) headers.set('cookie', `__session=${cookie}`)
  return new NextRequest(url, { headers })
}

test('returns 401 when session cookie is missing', async () => {
  const { GET } = await import('./route')
  const res = await GET(makeReq('proj1', 'sprint'), { params: Promise.resolve({ projectId: 'proj1' }) })
  expect(res.status).toBe(401)
})

test('returns 403 when user is not a project member', async () => {
  mockVerifySessionCookie.mockResolvedValue({ uid: 'uid-outsider' })
  mockGetDocs.mockResolvedValue({
    docs: [{
      id: 'org1',
      data: () => ({}),
    }],
  })
  mockGetDoc.mockResolvedValue({
    exists: true,
    data: () => PROJECT_DATA,
  })
  const { GET } = await import('./route')
  const res = await GET(makeReq('proj1', 'sprint', 'valid-cookie'), { params: Promise.resolve({ projectId: 'proj1' }) })
  expect(res.status).toBe(403)
})

test('returns ADO data for authorized member', async () => {
  mockVerifySessionCookie.mockResolvedValue({ uid: 'uid-owner' })
  mockGetDocs.mockImplementation((col?: unknown) => {
    // orgs collection scan returns one org
    if (!col) return Promise.resolve({ docs: [{ id: 'org1', data: () => ({}) }] })
    // adoCache query returns empty
    return Promise.resolve({ empty: true, docs: [] })
  })
  mockGetDoc.mockResolvedValue({
    exists: true,
    data: () => PROJECT_DATA,
  })
  mockSetDoc.mockResolvedValue(undefined)
  const { GET } = await import('./route')
  const res = await GET(makeReq('proj1', 'backlog&force=1', 'valid-cookie'), { params: Promise.resolve({ projectId: 'proj1' }) })
  expect(res.status).toBe(200)
})
