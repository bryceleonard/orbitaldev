import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: vi.fn(() => ({ push: vi.fn() })) }))

test('renders project name and member count', async () => {
  const { ProjectCard } = await import('./project-card')
  render(
    <ProjectCard
      project={{
        id: 'p1', name: 'Alpha Project', status: 'active',
        members: { uid1: 'owner' }, updatedAt: '2026-01-01',
        orgId: 'o1', description: '', techStack: [], pmTools: [],
        adoOrgUrl: '', adoProject: '', adoTeam: '', adoPat: '',
        sow: { startDate: '', endDate: '', totalHours: 0, budgetHours: 0, summary: '' },
        statusHeader: { scheduleStatus: 'on_track', budgetStatus: 'at_risk', scopeStatus: 'on_track' },
        createdBy: 'uid1', createdAt: '2026-01-01',
      }}
    />
  )
  expect(screen.getByText('Alpha Project')).toBeInTheDocument()
  expect(screen.getByText(/1 member/i)).toBeInTheDocument()
})
