import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/hooks/use-auth', () => ({
  useAuth: vi.fn(() => ({ user: { displayName: 'Client User', email: 'client@example.com' } })),
}))
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}))
global.fetch = vi.fn().mockResolvedValue({ ok: true })

test('renders Orbital branding and sign out button', async () => {
  const { PortalNav } = await import('./portal-nav')
  render(<PortalNav projectName="Alpha Project" />)
  expect(screen.getByText('Orbital')).toBeInTheDocument()
  expect(screen.getByText('Alpha Project')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
})
