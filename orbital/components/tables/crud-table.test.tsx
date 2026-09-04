import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

test('renders column headers', async () => {
  const { CrudTable } = await import('./crud-table')
  render(
    <CrudTable
      columns={[
        { key: 'title', label: 'Title', type: 'text' },
        { key: 'status', label: 'Status', type: 'select', options: ['open', 'resolved'] },
      ]}
      rows={[]}
      canEdit={true}
      onAdd={vi.fn().mockResolvedValue(undefined)}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByText('Title')).toBeInTheDocument()
  expect(screen.getByText('Status')).toBeInTheDocument()
})

test('calls onAdd when add row is submitted', async () => {
  const { CrudTable } = await import('./crud-table')
  const onAdd = vi.fn().mockResolvedValue(undefined)
  render(
    <CrudTable
      columns={[{ key: 'title', label: 'Title', type: 'text' }]}
      rows={[]}
      canEdit={true}
      onAdd={onAdd}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'New risk' } })
  fireEvent.click(screen.getByRole('button', { name: /add/i }))
  await vi.waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ title: 'New risk' })))
})

test('renders date input in add row for date column', async () => {
  const { CrudTable } = await import('./crud-table')
  render(
    <CrudTable
      columns={[{ key: 'dueDate', label: 'Due Date', type: 'date' }]}
      rows={[]}
      canEdit={true}
      onAdd={vi.fn().mockResolvedValue(undefined)}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByDisplayValue('')).toHaveAttribute('type', 'date')
})

test('renders number input in add row for number column', async () => {
  const { CrudTable } = await import('./crud-table')
  render(
    <CrudTable
      columns={[{ key: 'count', label: 'Count', type: 'number' }]}
      rows={[]}
      canEdit={true}
      onAdd={vi.fn().mockResolvedValue(undefined)}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  expect(screen.getByDisplayValue('0')).toHaveAttribute('type', 'number')
})

test('emptyDraft defaults number column to 0', async () => {
  const { CrudTable } = await import('./crud-table')
  const onAdd = vi.fn().mockResolvedValue(undefined)
  render(
    <CrudTable
      columns={[{ key: 'count', label: 'Count', type: 'number' }]}
      rows={[]}
      canEdit={true}
      onAdd={onAdd}
      onUpdate={vi.fn()}
      onDelete={vi.fn()}
    />
  )
  fireEvent.click(screen.getByRole('button', { name: /add/i }))
  await vi.waitFor(() => expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ count: 0 })))
})
