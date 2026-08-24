import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('@/hooks/use-auth', () => ({ useAuth: vi.fn(() => ({ user: { displayName: 'Bryce' } })) }))
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => '/dashboard'),
}))
global.fetch = vi.fn().mockResolvedValue({ ok: true })

test('renders dashboard nav link', async () => {
  const { PmSidebar } = await import('./pm-sidebar')
  render(<PmSidebar />)
  expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
})

test('renders sign out button', async () => {
  const { PmSidebar } = await import('./pm-sidebar')
  render(<PmSidebar />)
  expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
})
