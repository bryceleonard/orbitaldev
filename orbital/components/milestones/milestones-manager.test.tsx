import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import type { Milestone } from '@/lib/types'

vi.mock('@/components/milestones/backlog-item-card', () => ({
  BacklogItemCard: ({ milestone }: { milestone: Milestone }) => (
    <div data-testid="backlog-card">{milestone.name}</div>
  ),
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
    <button onClick={onClick}>{children}</button>
  ),
}))
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}))

const scheduled: Milestone = {
  id: 's1',
  name: 'Ship v1',
  status: 'not_started',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  history: [],
  createdAt: '',
  updatedAt: '',
  createdBy: 'u1',
}

const backlogItem: Milestone = {
  id: 'b1',
  name: 'Research idea',
  status: 'backlog',
  history: [],
  createdAt: '',
  updatedAt: '',
  createdBy: 'u1',
}

test('renders scheduled milestone in milestones section', async () => {
  const { MilestonesManager } = await import('./milestones-manager')
  render(
    <MilestonesManager
      milestones={[scheduled]}
      canEdit={false}
      onAddMilestone={vi.fn()}
      onAddBacklog={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Ship v1')).toBeInTheDocument()
  expect(screen.queryByTestId('backlog-card')).not.toBeInTheDocument()
})

test('renders backlog item as BacklogItemCard', async () => {
  const { MilestonesManager } = await import('./milestones-manager')
  render(
    <MilestonesManager
      milestones={[backlogItem]}
      canEdit={false}
      onAddMilestone={vi.fn()}
      onAddBacklog={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByTestId('backlog-card')).toHaveTextContent('Research idea')
})

test('renders both sections when both types present', async () => {
  const { MilestonesManager } = await import('./milestones-manager')
  render(
    <MilestonesManager
      milestones={[scheduled, backlogItem]}
      canEdit={false}
      onAddMilestone={vi.fn()}
      onAddBacklog={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Ship v1')).toBeInTheDocument()
  expect(screen.getByTestId('backlog-card')).toHaveTextContent('Research idea')
})

test('shows Add milestone and Add backlog item buttons for editors', async () => {
  const { MilestonesManager } = await import('./milestones-manager')
  render(
    <MilestonesManager
      milestones={[]}
      canEdit={true}
      onAddMilestone={vi.fn()}
      onAddBacklog={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Add milestone')).toBeInTheDocument()
  expect(screen.getByText('Add backlog item')).toBeInTheDocument()
})
