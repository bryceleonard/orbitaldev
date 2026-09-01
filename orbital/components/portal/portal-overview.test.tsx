import { render, screen } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import type { Risk, Resource, ClientAction } from '@/lib/types'

const mockProject = {
  id: 'p1', orgId: 'o1', name: 'Alpha', description: 'Test project',
  techStack: ['React', 'Next.js'], pmTools: [], status: 'active' as const,
  trackerBoards: [],
  members: { uid1: 'viewer' as const },
  sow: { startDate: '2026-01-01', endDate: '2026-12-31', totalHours: 1000, summary: 'Build it.' },
  statusHeader: {
    scheduleStatus: 'on_track' as const,
    budgetStatus: 'at_risk' as const,
    scopeStatus: 'on_track' as const,
  },
  createdBy: 'uid1', createdAt: '2026-01-01', updatedAt: '2026-01-01',
}

const mockResources: Resource[] = [
  { id: 'r1', name: 'Alice', role: 'Dev', hours: 300 },
  { id: 'r2', name: 'Bob',   role: 'QA',  hours: 180 },
]

const mockRisks: Risk[] = [
  {
    id: 'risk1', title: 'Budget overrun', severity: 'high',
    description: 'Costs rising fast.', status: 'open',
    owner: '', createdAt: '', updatedAt: '',
  },
  {
    id: 'risk2', title: 'Resolved risk', severity: 'low',
    description: '', status: 'resolved',
    owner: '', createdAt: '', updatedAt: '',
  },
]

const mockActions: ClientAction[] = [
  { id: 'a1', stakeholderName: 'Client Corp', description: 'Approve design', resolved: false },
  { id: 'a2', stakeholderName: 'Other',       description: 'Already done',   resolved: true },
]

vi.mock('@/lib/firebase/client', () => ({ auth: {}, db: {}, storage: {} }))
vi.mock('@/lib/firestore/resources', () => ({ listResources: vi.fn() }))
vi.mock('@/lib/firestore/risks', () => ({ listRisks: vi.fn() }))
vi.mock('@/lib/firestore/client-actions', () => ({ listClientActions: vi.fn() }))
vi.mock('@/hooks/use-org', () => ({ useOrgId: vi.fn(() => 'o1') }))
vi.mock('next/navigation', () => ({ useParams: vi.fn(() => ({ projectId: 'p1' })) }))
vi.mock('@/hooks/use-project', () => ({ useProject: vi.fn(() => ({ data: mockProject })) }))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: vi.fn(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'resources') return { data: mockResources }
      if (queryKey[0] === 'risks')     return { data: mockRisks }
      if (queryKey[0] === 'clientActions') return { data: mockActions }
      return { data: [] }
    }),
  }
})

describe('Consolidated portal overview page', () => {
  let Page: React.ComponentType

  beforeEach(async () => {
    Page = (await import('@/app/(client)/portal/[projectId]/overview/page')).default
  })

  test('renders project name, description, and tech stack', () => {
    render(<Page />)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Test project')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('Next.js')).toBeInTheDocument()
  })

  test('renders SOW summary', () => {
    render(<Page />)
    expect(screen.getByText('Build it.')).toBeInTheDocument()
  })

  test('renders engagement dates', () => {
    render(<Page />)
    expect(screen.getByText(/2026-01-01/)).toBeInTheDocument()
    expect(screen.getByText(/2026-12-31/)).toBeInTheDocument()
  })

  test('renders schedule percentage', () => {
    render(<Page />)
    expect(screen.getByText(/elapsed/i)).toBeInTheDocument()
  })

  test('renders budget percentage from resources (480 / 1000 = 48%)', () => {
    render(<Page />)
    expect(screen.getByText('48%')).toBeInTheDocument()
    expect(screen.getByText(/480 of 1000 hrs/i)).toBeInTheDocument()
  })

  test('renders only open risks (not resolved)', () => {
    render(<Page />)
    expect(screen.getByText('Budget overrun')).toBeInTheDocument()
    expect(screen.queryByText('Resolved risk')).not.toBeInTheDocument()
  })

  test('renders unresolved actions only', () => {
    render(<Page />)
    expect(screen.getByText('Client Corp')).toBeInTheDocument()
    expect(screen.queryByText('Other')).not.toBeInTheDocument()
  })

  test('does not render scope status', () => {
    render(<Page />)
    expect(screen.queryByText(/scope/i)).not.toBeInTheDocument()
  })
})
