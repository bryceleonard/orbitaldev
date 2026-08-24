import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'

global.fetch = vi.fn()

const mockFetch = global.fetch as ReturnType<typeof vi.fn>

test('renders upload button', async () => {
  const { FileUploadButton } = await import('./file-upload-button')
  render(<FileUploadButton orgId="o1" projectId="p1" onUploaded={vi.fn()} />)
  expect(screen.getByRole('button', { name: /upload file/i })).toBeInTheDocument()
})

test('calls /api/files/upload then PUTs to signed URL on file selection', async () => {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ uploadUrl: 'https://storage.googleapis.com/signed', fileId: 'file-1' }),
    })
    .mockResolvedValueOnce({ ok: true })

  const onUploaded = vi.fn()
  const { FileUploadButton } = await import('./file-upload-button')
  render(<FileUploadButton orgId="o1" projectId="p1" onUploaded={onUploaded} />)

  const input = screen.getByTestId('file-input')
  const file = new File(['hello'], 'test.pdf', { type: 'application/pdf' })
  Object.defineProperty(input, 'files', { value: [file] })
  fireEvent.change(input)

  await vi.waitFor(() => {
    expect(mockFetch).toHaveBeenNthCalledWith(1, '/api/files/upload', expect.objectContaining({ method: 'POST' }))
    expect(mockFetch).toHaveBeenNthCalledWith(2, 'https://storage.googleapis.com/signed', expect.objectContaining({ method: 'PUT' }))
    expect(onUploaded).toHaveBeenCalled()
  })
})
