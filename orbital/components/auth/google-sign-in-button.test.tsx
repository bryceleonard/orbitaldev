import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: vi.fn(function () { return {} }),
  signInWithPopup: vi.fn().mockResolvedValue({
    user: { getIdToken: vi.fn().mockResolvedValue('token-123') },
  }),
  getAuth: vi.fn(function () { return {} }),
}))
vi.mock('@/lib/firebase/client', () => ({ auth: {} }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ replace: vi.fn() })) }))

global.fetch = vi.fn().mockResolvedValue({ ok: true })

test('renders Sign in with Google button', async () => {
  const { GoogleSignInButton } = await import('./google-sign-in-button')
  render(<GoogleSignInButton />)
  expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
})

test('calls signInWithPopup and posts token on click', async () => {
  const { signInWithPopup } = await import('firebase/auth')
  const { GoogleSignInButton } = await import('./google-sign-in-button')
  render(<GoogleSignInButton />)
  fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))
  await vi.waitFor(() => {
    expect(signInWithPopup).toHaveBeenCalled()
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/auth/session',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
