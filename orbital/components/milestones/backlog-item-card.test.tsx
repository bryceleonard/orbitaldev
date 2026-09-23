import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import type { Milestone } from '@/lib/types'

vi.mock('@/components/ui/markdown-body', () => ({
  MarkdownBody: ({ content }: { content: string }) => <div data-testid="markdown">{content}</div>,
}))
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, ...rest }: React.PropsWithChildren<{ onClick?: () => void; disabled?: boolean; [k: string]: unknown }>) => (
    <button onClick={onClick} disabled={disabled}>{children}</button>
  ),
}))
vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: React.PropsWithChildren) => <label>{children}</label>,
}))

const base: Milestone = {
  id: 'm1',
  name: 'Research spike',
  status: 'backlog',
  description: '## Goals\n\nDefine scope.',
  history: [],
  createdAt: '2026-09-23T00:00:00Z',
  updatedAt: '2026-09-23T00:00:00Z',
  createdBy: 'uid1',
}

test('renders name and markdown description', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  render(
    <BacklogItemCard
      milestone={base}
      canEdit={false}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Research spike')).toBeInTheDocument()
  expect(screen.getByTestId('markdown')).toHaveTextContent('## Goals')
})

test('hides edit and delete buttons when canEdit is false', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  render(
    <BacklogItemCard
      milestone={base}
      canEdit={false}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  expect(screen.queryByText('Delete')).not.toBeInTheDocument()
})

test('blocks status change and shows error when no dates', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  const onStatusChange = vi.fn()
  render(
    <BacklogItemCard
      milestone={base}
      canEdit={true}
      onStatusChange={onStatusChange}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  const select = screen.getByRole('combobox')
  fireEvent.change(select, { target: { value: 'not_started' } })
  expect(onStatusChange).not.toHaveBeenCalled()
  expect(screen.getByText(/add start and end dates before scheduling/i)).toBeInTheDocument()
})

test('allows status change when dates are present', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  const onStatusChange = vi.fn().mockResolvedValue(undefined)
  const withDates: Milestone = { ...base, startDate: '2026-10-01', endDate: '2026-10-31' }
  render(
    <BacklogItemCard
      milestone={withDates}
      canEdit={true}
      onStatusChange={onStatusChange}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  const select = screen.getByRole('combobox')
  fireEvent.change(select, { target: { value: 'not_started' } })
  expect(onStatusChange).toHaveBeenCalledWith(withDates, 'not_started')
})

test('shows "No description" placeholder when description is absent', async () => {
  const { BacklogItemCard } = await import('./backlog-item-card')
  const noDesc: Milestone = { ...base, description: undefined }
  render(
    <BacklogItemCard
      milestone={noDesc}
      canEdit={false}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText(/no description/i)).toBeInTheDocument()
})
