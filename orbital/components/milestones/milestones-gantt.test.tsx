import { render, screen } from '@testing-library/react'
import type { Milestone } from '@/lib/types'

const scheduled: Milestone = {
  id: 'm1',
  name: 'Ship v1',
  status: 'not_started',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  history: [],
  createdAt: '',
  updatedAt: '',
  createdBy: 'u1',
}

test('renders scheduled milestone name', async () => {
  const { MilestonesGantt } = await import('./milestones-gantt')
  render(<MilestonesGantt milestones={[scheduled]} />)
  expect(screen.getAllByText('Ship v1').length).toBeGreaterThan(0)
})

test('renders empty state when no milestones', async () => {
  const { MilestonesGantt } = await import('./milestones-gantt')
  render(<MilestonesGantt milestones={[]} />)
  expect(screen.getByText(/no milestones yet/i)).toBeInTheDocument()
})
