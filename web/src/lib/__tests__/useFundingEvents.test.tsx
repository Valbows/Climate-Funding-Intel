import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { useFundingEvents } from '../useFundingEvents'

function HookConsumer(props: any) {
  const res = useFundingEvents(props.params)
  return (
    <div>
      <div data-testid="count">{res.count}</div>
      <div data-testid="page">{res.page}</div>
      <div data-testid="limit">{res.limit}</div>
      <div data-testid="isLoading">{String(res.isLoading)}</div>
      <div data-testid="isError">{String(res.isError)}</div>
      <div data-testid="error">{res.error ? (res.error as Error).message : ''}</div>
    </div>
  )
}

describe('useFundingEvents', () => {
  const originalFetch = (globalThis as any).fetch
  afterEach(() => {
    ;(globalThis as any).fetch = originalFetch
    jest.clearAllMocks()
  })

  test('builds request URL with params and sets values', async () => {
    const mockJson = {
      events: [],
      count: 5,
      page: 2,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => mockJson })
    ;(globalThis as any).fetch = fetchMock

    render(<HookConsumer params={{ q: 'abc', page: 2, limit: 10 }} />)

    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('5'))
    expect(screen.getByTestId('page')).toHaveTextContent('2')
    expect(screen.getByTestId('limit')).toHaveTextContent('10')

    expect(fetchMock).toHaveBeenCalled()
    const calledWith = fetchMock.mock.calls[0][0] as string
    expect(calledWith).toBe('/api/funding-events?q=abc&page=2&limit=10')
  })

  test('surfaces API error payload as isError', async () => {
    const mockJson = {
      events: [],
      count: 0,
      page: 1,
      limit: 20,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: 'boom',
    }
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => mockJson })
    ;(globalThis as any).fetch = fetchMock

    render(<HookConsumer params={{}} />)

    await waitFor(() => expect(screen.getByTestId('isError')).toHaveTextContent('true'))
    expect(screen.getByTestId('error')).toHaveTextContent('boom')
  })
})
