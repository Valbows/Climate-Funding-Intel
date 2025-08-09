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

describe('FundingEventsList internal link', () => {
  const originalFetch = (globalThis as any).fetch

  afterEach(() => {
    restoreFetch(originalFetch)
    jest.clearAllMocks()
  })

  test('rows link to internal company page using slug', async () => {
    setFetch(jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        events: [
          { id: 1, startup_name: 'Acme Solar', sub_sector: 'Solar', geography: 'USA', funding_date: '2025-01-02', amount_usd: 1000000, source_url: 'https://example.com' },
        ],
        count: 1,
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

    await waitFor(() => expect(screen.getByTestId('funding-events')).toBeInTheDocument())

    const link = screen.getByRole('link', { name: /Acme Solar/i })
    expect(link).toHaveAttribute('href', '/companies/acme-solar')
  })
})
