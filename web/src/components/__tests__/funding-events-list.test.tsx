import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { FundingEventsList } from '../funding-events-list'

const setFetch = (impl: any) => {
  ;(globalThis as any).fetch = impl
}

const restoreFetch = (original: any) => {
  ;(globalThis as any).fetch = original
}

describe('FundingEventsList', () => {
  const originalFetch = (globalThis as any).fetch

  afterEach(() => {
    restoreFetch(originalFetch)
    jest.clearAllMocks()
  })

  test('renders empty state when no events', async () => {
    setFetch(jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [], count: 0, page: 1, limit: 10, lastUpdated: null, error: null }),
    }))

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList q="zzz" enabled={true} />
      </SWRConfig>
    )

    await waitFor(() => expect(screen.getByTestId('fe-empty')).toBeInTheDocument())
  })

  test('renders error state when API error', async () => {
    setFetch(jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ events: [], count: 0, page: 1, limit: 10, lastUpdated: null, error: 'boom' }),
    }))

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} />
      </SWRConfig>
    )

    await waitFor(() => expect(screen.getByTestId('fe-error')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
  })

  test('renders a list of events', async () => {
    setFetch(jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          { id: 1, startup_name: 'Acme Solar', sub_sector: 'Solar', geography: 'USA', funding_date: '2025-01-02', amount_usd: 1000000 },
          { id: 2, startup_name: 'Windy Inc', sub_sector: 'Wind', geography: 'Germany', funding_date: '2025-02-03', amount_usd: 2000000 },
        ],
        count: 2,
        page: 1,
        limit: 10,
        lastUpdated: '2025-08-08T00:00:00Z',
        error: null,
      }),
    }))

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} />
      </SWRConfig>
    )

    // Wait for list
    await waitFor(() => expect(screen.getByTestId('funding-events')).toBeInTheDocument())

    // Should not show loading or empty or error now
    expect(screen.queryByTestId('fe-loading')).toBeNull()
    expect(screen.queryByTestId('fe-empty')).toBeNull()
    expect(screen.queryByTestId('fe-error')).toBeNull()

    // Count label
    expect(screen.getByText(/Recent Funding Events/i)).toBeInTheDocument()
    expect(screen.getByText(/2 total/)).toBeInTheDocument()

    // Items
    expect(screen.getByText('Acme Solar')).toBeInTheDocument()
    expect(screen.getByText('Windy Inc')).toBeInTheDocument()
  })
})
