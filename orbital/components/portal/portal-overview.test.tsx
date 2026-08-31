import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

const mockProject = {
  id: 'p1', orgId: 'o1', name: 'Alpha', description: 'Test project',
  techStack: ['React', 'Next.js'], pmTools: [], status: 'active' as const,
  adoOrgUrl: '', adoProject: '', adoTeam: '', adoPat: '',
  members: { uid1: 'viewer' as const },
  sow: { startDate: '2026-01-01', endDate: '2026-12-31', totalHours: 200, summary: 'Build it.' },
  statusHeader: { scheduleStatus: 'on_track' as const, budgetStatus: 'at_risk' as const, scopeStatus: 'on_track' as const },
  createdBy: 'uid1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

vi.mock('@/hooks/use-org', () => ({ useOrgId: vi.fn(() => 'o1') }))
vi.mock('next/navigation', () => ({ useParams: vi.fn(() => ({ projectId: 'p1' })) }))
vi.mock('@/hooks/use-project', () => ({
  useProject: vi.fn(() => ({ data: mockProject })),
}))

test('renders project name, description, and tech stack', async () => {
  const Page = (await import('@/app/(client)/portal/[projectId]/overview/page')).default
  render(<Page />)
  expect(screen.getByText('Alpha')).toBeInTheDocument()
  expect(screen.getByText('Test project')).toBeInTheDocument()
  expect(screen.getByText('React')).toBeInTheDocument()
})

test('renders SOW summary', async () => {
  const Page = (await import('@/app/(client)/portal/[projectId]/overview/page')).default
  render(<Page />)
  expect(screen.getByText('Build it.')).toBeInTheDocument()
})

test('renders status badges for all three indicators', async () => {
  const Page = (await import('@/app/(client)/portal/[projectId]/overview/page')).default
  render(<Page />)
  expect(screen.getAllByText('On Track').length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText('At Risk')).toBeInTheDocument()
})
