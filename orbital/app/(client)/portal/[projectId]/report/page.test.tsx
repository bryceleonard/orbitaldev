import { render, screen } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import type { Risk, Milestone } from '@/lib/types'

const mockProject = {
  id: 'p1', orgId: 'o1', name: 'Quattro', description: 'Platform project',
  techStack: ['React', 'Next.js'], pmTools: [], status: 'active' as const,
  trackerBoards: [], members: { uid1: 'owner' as const },
  sow: { startDate: '2026-01-01', endDate: '2026-12-31', totalHours: 500, summary: 'Build it.' },
  statusHeader: {
    scheduleStatus: 'on_track' as const,
    budgetStatus: 'at_risk' as const,
    scopeStatus: 'on_track' as const,
  },
  hoursUsed: 200,
  createdBy: 'uid1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

const mockRisks: Risk[] = [
  {
    id: 'r1', title: 'Scope creep', severity: 'high', description: 'Growing requirements.',
    status: 'open', owner: '', createdAt: '', updatedAt: '',
  },
  {
    id: 'r2', title: 'Old risk', severity: 'low', description: '',
    status: 'resolved', owner: '', createdAt: '', updatedAt: '',
  },
]

const mockMilestones: Milestone[] = [
  {
    id: 'm1', name: 'Alpha Release', status: 'in_progress',
    startDate: '2026-02-01', endDate: '2026-03-01',
    history: [], createdAt: '', updatedAt: '', createdBy: '',
  },
]

vi.mock('@/lib/firebase/client', () => ({ auth: {}, db: {}, storage: {} }))
vi.mock('@/lib/firestore/risks', () => ({ listRisks: vi.fn() }))
vi.mock('@/lib/firestore/milestones', () => ({ listMilestones: vi.fn() }))
vi.mock('@/lib/firestore/ado-cache', () => ({ getLatestBoardCache: vi.fn() }))
vi.mock('@/hooks/use-org', () => ({ useOrgId: vi.fn(() => 'o1') }))
vi.mock('next/navigation', () => ({ useParams: vi.fn(() => ({ projectId: 'p1' })) }))
vi.mock('@/hooks/use-project', () => ({ useProject: vi.fn(() => ({ data: mockProject })) }))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'risks')      return { data: mockRisks }
      if (queryKey[0] === 'milestones') return { data: mockMilestones }
      return { data: undefined }
    }),
  }
})

describe('PortalReportPage', () => {
  let Page: React.ComponentType

  beforeEach(async () => {
    Page = (await import('./page')).default
  })

  test('renders project name and description', () => {
    render(<Page />)
    expect(screen.getByText('Quattro')).toBeInTheDocument()
    expect(screen.getByText('Platform project')).toBeInTheDocument()
  })

  test('renders FortyAU header and report label', () => {
    render(<Page />)
    expect(screen.getByText('FortyAU')).toBeInTheDocument()
    expect(screen.getByText(/project status report/i)).toBeInTheDocument()
  })

  test('renders schedule and budget metric blocks', () => {
    render(<Page />)
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    expect(screen.getByText('Budget')).toBeInTheDocument()
  })

  test('renders budget detail line: 200 of 500 hrs', () => {
    render(<Page />)
    expect(screen.getByText(/200 of 500 hrs/i)).toBeInTheDocument()
  })

  test('renders only open risks', () => {
    render(<Page />)
    expect(screen.getByText('Scope creep')).toBeInTheDocument()
    expect(screen.queryByText('Old risk')).not.toBeInTheDocument()
  })

  test('renders milestone name and status', () => {
    render(<Page />)
    expect(screen.getByText('Alpha Release')).toBeInTheDocument()
    expect(screen.getByText('In Progress')).toBeInTheDocument()
  })

  test('renders Print button', () => {
    render(<Page />)
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
  })
})
