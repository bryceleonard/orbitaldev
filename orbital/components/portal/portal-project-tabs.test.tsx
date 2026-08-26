import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { TrackerBoard } from '@/lib/types'

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/portal/p1/status'),
  useParams: vi.fn(() => ({ projectId: 'p1' })),
}))

const adoBoard: TrackerBoard = {
  id: 'b1', label: 'Alpha', type: 'ado',
  adoOrgUrl: '', adoProject: '', adoPat: '', adoTeam: '', beadsRepo: '', beadsBranch: 'main',
}
const beadsBoard: TrackerBoard = {
  id: 'b2', label: 'Issues', type: 'beads',
  adoOrgUrl: '', adoProject: '', adoPat: '', adoTeam: '', beadsRepo: 'repo', beadsBranch: 'main',
}

test('renders static tabs without boards', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[]} />)
  for (const label of ['Overview', 'Status', 'Documents', 'Links']) {
    expect(screen.getByText(label)).toBeInTheDocument()
  }
  expect(screen.queryByText('ADO')).not.toBeInTheDocument()
})

test('renders board tab with board label', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[adoBoard]} />)
  expect(screen.getByText('Alpha')).toBeInTheDocument()
})

test('renders two board tabs for two boards', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[adoBoard, beadsBoard]} />)
  expect(screen.getByText('Alpha')).toBeInTheDocument()
  expect(screen.getByText('Issues')).toBeInTheDocument()
})

test('board tab links to /portal/[id]/boards/[boardId]', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[adoBoard]} />)
  const link = screen.getByRole('link', { name: 'Alpha' })
  expect(link).toHaveAttribute('href', '/portal/p1/boards/b1')
})

test('active tab has aria-current', async () => {
  const { PortalProjectTabs } = await import('./portal-project-tabs')
  render(<PortalProjectTabs projectId="p1" trackerBoards={[]} />)
  expect(screen.getByRole('link', { name: /status/i })).toHaveAttribute('aria-current', 'page')
})
