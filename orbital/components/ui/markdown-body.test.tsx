import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="md">{children}</div>,
}))

test('renders content inside a prose wrapper', async () => {
  const { MarkdownBody } = await import('./markdown-body')
  render(<MarkdownBody content={"## Hello\n\nWorld"} />)
  expect(screen.getByTestId('md')).toHaveTextContent('## Hello')
})

test('applies prose classes to wrapper div', async () => {
  const { MarkdownBody } = await import('./markdown-body')
  const { container } = render(<MarkdownBody content="text" />)
  const wrapper = container.firstChild as HTMLElement
  expect(wrapper.className).toContain('prose')
})
