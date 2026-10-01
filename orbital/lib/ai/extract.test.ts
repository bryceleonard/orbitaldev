import { vi } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: mockCreate } }
  }),
}))

test('extractIntelligence parses Claude JSON response', async () => {
  const payload = {
    summary: 'Team agreed to migrate to GraphQL by Q4.',
    decisions: [{ question: 'Use GraphQL?', background: 'REST is slow', priority: 'high', status: 'decided', outcome: 'Yes' }],
    milestones: [{ name: 'GraphQL migration', status: 'not_started', endDate: '2026-12-31' }],
    risks: [{ title: 'Migration risk', description: 'Breaking changes', severity: 'medium' }],
    issues: [],
  }
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  })
  const { extractIntelligence } = await import('./extract')
  const result = await extractIntelligence('some transcript text')
  expect(result.summary).toBe('Team agreed to migrate to GraphQL by Q4.')
  expect(result.decisions).toHaveLength(1)
  expect(result.decisions[0].question).toBe('Use GraphQL?')
  expect(result.milestones).toHaveLength(1)
  expect(result.risks).toHaveLength(1)
  expect(result.issues).toHaveLength(0)
})

test('extractIntelligence returns empty arrays on malformed JSON', async () => {
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: 'not json at all' }],
  })
  const { extractIntelligence } = await import('./extract')
  const result = await extractIntelligence('some text')
  expect(result.summary).toBe('')
  expect(result.decisions).toEqual([])
  expect(result.milestones).toEqual([])
  expect(result.risks).toEqual([])
  expect(result.issues).toEqual([])
})
