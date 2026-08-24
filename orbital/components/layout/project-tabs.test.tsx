import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/projects/p1/status'),
  useParams: vi.fn(() => ({ projectId: 'p1' })),
}))

test('renders all nine tab labels', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" />)
  const labels = ['Overview', 'SOW', 'Status', 'Files', 'ADO Board', 'Dev Plan', 'Stakeholders', 'Links', 'Roadmap']
  for (const label of labels) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
})

test('active tab has aria-current', async () => {
  const { ProjectTabs } = await import('./project-tabs')
  render(<ProjectTabs projectId="p1" />)
  const statusLink = screen.getByRole('link', { name: /status/i })
  expect(statusLink).toHaveAttribute('aria-current', 'page')
})
