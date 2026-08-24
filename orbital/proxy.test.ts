import { vi, describe, test, expect } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('firebase-admin/auth', () => ({
  getAuth: vi.fn(() => ({
    verifySessionCookie: vi.fn().mockRejectedValue(new Error('invalid')),
  })),
}))
vi.mock('firebase-admin/app', () => ({
  initializeApp: vi.fn(),
  getApps: vi.fn(() => ['app']),
  cert: vi.fn(),
}))
vi.mock('firebase-admin/firestore', () => ({
  getFirestore: vi.fn(() => ({})),
}))

function makeRequest(path: string, cookie?: string) {
  const url = `http://localhost:3000${path}`
  const headers = new Headers()
  if (cookie) headers.set('cookie', `__session=${cookie}`)
  return new NextRequest(url, { headers })
}

describe('proxy', () => {
  test('redirects unauthenticated user from /dashboard to /login', async () => {
    const { proxy } = await import('./proxy')
    const res = await proxy(makeRequest('/dashboard'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  test('redirects request with invalid cookie from /portal to /login', async () => {
    const { proxy } = await import('./proxy')
    const res = await proxy(makeRequest('/portal', 'bad-cookie'))
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toContain('/login')
  })

  test('allows unauthenticated access to /login', async () => {
    const { proxy } = await import('./proxy')
    const res = await proxy(makeRequest('/login'))
    expect(res.status).not.toBe(307)
  })

  test('allows unauthenticated access to /onboarding', async () => {
    const { proxy } = await import('./proxy')
    const res = await proxy(makeRequest('/onboarding'))
    expect(res.status).not.toBe(307)
  })
})
