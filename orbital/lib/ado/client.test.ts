import { vi, test, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

beforeEach(() => vi.clearAllMocks())

function adoOk(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
}

test('fetchBacklog POSTs WIQL query with Basic auth header', async () => {
  mockFetch.mockReturnValue(adoOk({ value: [] }))
  const { fetchBacklog } = await import('./client')
  await fetchBacklog('https://dev.azure.com/myorg', 'MyProject', 'my-pat')
  expect(mockFetch).toHaveBeenCalledWith(
    expect.stringContaining('wiql'),
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: expect.stringContaining('Basic '),
      }),
    })
  )
})

test('fetchSprint GETs current iteration', async () => {
  mockFetch.mockReturnValue(adoOk({ value: [] }))
  const { fetchSprint } = await import('./client')
  await fetchSprint('https://dev.azure.com/myorg', 'MyProject', 'MyTeam', 'my-pat')
  const [url] = mockFetch.mock.calls[0]
  expect(url).toContain('iterations')
  expect(url).toContain('current')
})

test('fetchDevPlan GETs all iterations without timeframe filter', async () => {
  mockFetch.mockReturnValue(adoOk({ value: [] }))
  const { fetchDevPlan } = await import('./client')
  await fetchDevPlan('https://dev.azure.com/myorg', 'MyProject', 'my-pat')
  const [url] = mockFetch.mock.calls[0]
  expect(url).toContain('iterations')
  expect(url).not.toContain('current')
})

test('throws on non-ok ADO response', async () => {
  mockFetch.mockReturnValue(Promise.resolve({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') }))
  const { fetchBacklog } = await import('./client')
  await expect(fetchBacklog('https://dev.azure.com/myorg', 'MyProject', 'bad-pat')).rejects.toThrow('ADO request failed')
})
