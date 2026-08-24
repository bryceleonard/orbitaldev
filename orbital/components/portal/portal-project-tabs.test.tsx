import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/portal/p1/status'),
  useParams: vi.fn(() => ({ projectId: 'p1' })),
}))

test('renders all five portal tabs', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" />)
  for (const label of ['Overview', 'Status', 'Documents', 'ADO', 'Links']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
})

test('active tab has aria-current', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" />)
  expect(screen.getByRole('link', { name: /status/i })).toHaveAttribute('aria-current', 'page')
})
