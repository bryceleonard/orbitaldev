import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

const mockAddMember = vi.fn().mockResolvedValue(undefined)
vi.mock('@/lib/firestore/projects', () => ({ addMember: mockAddMember }))
vi.mock('@/hooks/use-org', () => ({ useOrgId: vi.fn(() => 'org1') }))

test('calls addMember with uid and selected role on submit', async () => {
  const { ShareDialog } = await import('./share-dialog')
  render(
    <ShareDialog projectId="proj1" open onOpenChange={vi.fn()} onSuccess={vi.fn()} />
  )
  fireEvent.change(screen.getByLabelText(/user id/i), { target: { value: 'uid-new' } })
  fireEvent.click(screen.getByRole('button', { name: /add member/i }))
  await vi.waitFor(() => {
    expect(mockAddMember).toHaveBeenCalledWith('org1', 'proj1', 'uid-new', 'editor')
  })
})
