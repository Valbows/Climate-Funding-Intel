import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SWRConfig } from 'swr'
import { FundingEventsList } from '../funding-events-list'

const setFetch = (impl: any) => {
  ;(globalThis as any).fetch = impl
}

const restoreFetch = (original: any) => {
  ;(globalThis as any).fetch = original
}

describe('FundingEventsList pagination', () => {
  const originalFetch = (globalThis as any).fetch

  afterEach(() => {
    restoreFetch(originalFetch)
    jest.clearAllMocks()
  })

  test('resets to page 1 when filters change', async () => {
    const initial = {
      events: [
        { id: 'a1', startup_name: 'Alpha', sub_sector: 'Solar', geography: 'US', funding_date: '2025-01-01', amount_usd: 100 },
      ],
      count: 15,
      page: 1,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }
    const page2 = {
      events: [
        { id: 'a2', startup_name: 'Bravo', sub_sector: 'Wind', geography: 'DE', funding_date: '2025-01-02', amount_usd: 200 },
      ],
      count: 15,
      page: 2,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }
    const filtered = {
      events: [
        { id: 'f1', startup_name: 'Filter Hit', sub_sector: 'Hydrogen', geography: 'UK', funding_date: '2025-01-03', amount_usd: 300 },
      ],
      count: 1,
      page: 1,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }

    const fetchMock = jest.fn((url: string) => {
      const u = new URL(url, 'http://localhost')
      const q = u.searchParams.get('q') || ''
      const page = Number(u.searchParams.get('page') || '1')
      if (q === 'h2' && page === 1) return Promise.resolve({ ok: true, json: async () => filtered })
      if (page === 2) return Promise.resolve({ ok: true, json: async () => page2 })
      return Promise.resolve({ ok: true, json: async () => initial })
    })
    setFetch(fetchMock)

    const { rerender } = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} limit={10} q="" />
      </SWRConfig>
    )

    // On page 1 initially
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 1 of 2'))

    // Go to page 2
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 2 of 2'))
    expect(screen.getByText('Bravo')).toBeInTheDocument()

    // Change filter (q) -> should reset back to page 1, fetch new data
    rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} limit={10} q="h2" />
      </SWRConfig>
    )
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 1 of 1'))
    expect(screen.getByText('Filter Hit')).toBeInTheDocument()
  })

  test('paginates with Next and Prev buttons', async () => {
    const page1 = {
      events: [
        { id: 'p1-1', startup_name: 'P1 Item 1', sub_sector: 'Solar', geography: 'US', funding_date: '2025-01-01', amount_usd: 100 },
        { id: 'p1-2', startup_name: 'P1 Item 2', sub_sector: 'Wind', geography: 'DE', funding_date: '2025-01-02', amount_usd: 200 },
      ],
      count: 25,
      page: 1,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }
    const page2 = {
      events: [
        { id: 'p2-1', startup_name: 'P2 Item 1', sub_sector: 'Hydrogen', geography: 'UK', funding_date: '2025-01-03', amount_usd: 300 },
        { id: 'p2-2', startup_name: 'P2 Item 2', sub_sector: 'Geo', geography: 'IS', funding_date: '2025-01-04', amount_usd: 400 },
      ],
      count: 25,
      page: 2,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }

    const fetchMock = jest.fn((url: string) => {
      if (url.includes('page=2')) {
        return Promise.resolve({ ok: true, json: async () => page2 })
      }
      return Promise.resolve({ ok: true, json: async () => page1 })
    })
    setFetch(fetchMock)

    render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} limit={10} />
      </SWRConfig>
    )

    // Page 1
    await waitFor(() => expect(screen.getByTestId('funding-events')).toBeInTheDocument())
    expect(screen.getByText('P1 Item 1')).toBeInTheDocument()
    expect(screen.getByText('P1 Item 2')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 1 of 3'))
    let prev = screen.getByRole('button', { name: /Previous/i }) as HTMLButtonElement
    let next = screen.getByRole('button', { name: /Next/i }) as HTMLButtonElement
    expect(prev).toBeDisabled()
    expect(next).toBeEnabled()

    // Next to page 2
    fireEvent.click(next)
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 2 of 3'))
    expect(screen.getByText('P2 Item 1')).toBeInTheDocument()
    expect(screen.getByText('P2 Item 2')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Previous/i })).toBeEnabled())
    prev = screen.getByRole('button', { name: /Previous/i }) as HTMLButtonElement

    // Back to page 1
    fireEvent.click(prev)
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 1 of 3'))
    expect(screen.getByText('P1 Item 1')).toBeInTheDocument()
  })

  test('resets to page 1 when investor changes', async () => {
    const initial = {
      events: [
        { id: 'i1', startup_name: 'Alpha', sub_sector: 'Solar', geography: 'US', funding_date: '2025-01-01', amount_usd: 100 },
      ],
      count: 15,
      page: 1,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }
    const page2 = {
      events: [
        { id: 'i2', startup_name: 'Bravo', sub_sector: 'Wind', geography: 'DE', funding_date: '2025-01-02', amount_usd: 200 },
      ],
      count: 15,
      page: 2,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }
    const filtered = {
      events: [
        { id: 'ti1', startup_name: 'Tiger One', sub_sector: 'Hydrogen', geography: 'UK', funding_date: '2025-01-03', amount_usd: 300 },
      ],
      count: 1,
      page: 1,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }

    const fetchMock = jest.fn((url: string) => {
      const u = new URL(url, 'http://localhost')
      const investor = u.searchParams.get('investor') || ''
      const page = Number(u.searchParams.get('page') || '1')
      if (investor === 'Tiger') return Promise.resolve({ ok: true, json: async () => filtered })
      if (page === 2) return Promise.resolve({ ok: true, json: async () => page2 })
      return Promise.resolve({ ok: true, json: async () => initial })
    })
    setFetch(fetchMock)

    const { rerender } = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} limit={10} />
      </SWRConfig>
    )

    // Page 1 -> then go to page 2
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 1 of 2'))
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 2 of 2'))
    expect(screen.getByText('Bravo')).toBeInTheDocument()

    // Change investor filter -> should reset to page 1
    rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} limit={10} investor="Tiger" />
      </SWRConfig>
    )
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 1 of 1'))
    expect(screen.getByText('Tiger One')).toBeInTheDocument()
  })

  test('resets to page 1 when date range changes', async () => {
    const page1 = {
      events: [
        { id: 'd1', startup_name: 'January One', sub_sector: 'Solar', geography: 'US', funding_date: '2025-01-01', amount_usd: 100 },
      ],
      count: 15,
      page: 1,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }
    const page2 = {
      events: [
        { id: 'd2', startup_name: 'January Two', sub_sector: 'Wind', geography: 'DE', funding_date: '2025-01-02', amount_usd: 200 },
      ],
      count: 15,
      page: 2,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }
    const newRange = {
      events: [
        { id: 'f1', startup_name: 'February Item', sub_sector: 'Hydrogen', geography: 'UK', funding_date: '2025-02-05', amount_usd: 300 },
      ],
      count: 1,
      page: 1,
      limit: 10,
      lastUpdated: '2025-08-08T00:00:00Z',
      error: null,
    }

    const fetchMock = jest.fn((url: string) => {
      const u = new URL(url, 'http://localhost')
      const from = u.searchParams.get('from') || ''
      const to = u.searchParams.get('to') || ''
      const page = Number(u.searchParams.get('page') || '1')
      if (to === '2025-02-28') return Promise.resolve({ ok: true, json: async () => newRange })
      if (page === 2) return Promise.resolve({ ok: true, json: async () => page2 })
      return Promise.resolve({ ok: true, json: async () => page1 })
    })
    setFetch(fetchMock)

    const { rerender } = render(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} limit={10} from="2025-01-01" to="2025-01-31" />
      </SWRConfig>
    )

    // Page 1 -> page 2
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 1 of 2'))
    fireEvent.click(screen.getByRole('button', { name: /Next/i }))
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 2 of 2'))
    expect(screen.getByText('January Two')).toBeInTheDocument()

    // Change date range -> reset to page 1
    rerender(
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <FundingEventsList enabled={true} limit={10} from="2025-01-01" to="2025-02-28" />
      </SWRConfig>
    )
    await waitFor(() => expect(screen.getByTestId('fe-pagination')).toHaveTextContent('Page 1 of 1'))
    expect(screen.getByText('February Item')).toBeInTheDocument()
  })
})
