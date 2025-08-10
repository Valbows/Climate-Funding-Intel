import useSWR from 'swr'

export type FundingEvent = {
  id?: string | number
  startup_name?: string
  sub_sector?: string
  geography?: string
  funding_date?: string
  source_url?: string
  // Primary DB field name
  amount_raised_usd?: number | null
  // Deprecated alias used by older UI code (kept for compatibility)
  amount_usd?: number | null
  [key: string]: any
}

export type FundingEventsResponse = {
  events: FundingEvent[]
  count: number
  page: number
  limit: number
  lastUpdated: string | null
  error: string | null
}

export type FundingEventsParams = {
  q?: string
  sub_sector?: string
  investor?: string
  from?: string
  to?: string
  page?: number
  limit?: number
}

const fetcher = (url: string) => fetch(url).then((r) => r.json())

function buildUrl(params: FundingEventsParams): string {
  const url = new URL('/api/funding-events', typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  const qp = new URLSearchParams()
  if (params.q) qp.set('q', params.q)
  if (params.sub_sector) qp.set('sub_sector', params.sub_sector)
  if (params.investor) qp.set('investor', params.investor)
  if (params.from) qp.set('from', params.from)
  if (params.to) qp.set('to', params.to)
  if (params.page) qp.set('page', String(params.page))
  if (params.limit) qp.set('limit', String(params.limit))
  const qs = qp.toString()
  return qs ? `${url.pathname}?${qs}` : url.pathname
}

export function useFundingEvents(params: FundingEventsParams, enabled: boolean = true) {
  const key = enabled ? buildUrl(params) : null
  const { data, error, isLoading, mutate } = useSWR<FundingEventsResponse>(key, fetcher, {
    revalidateOnFocus: false,
  })

  const apiError = data?.error ? new Error(data.error) : null

  return {
    events: data?.events ?? [],
    count: data?.count ?? 0,
    page: data?.page ?? params.page ?? 1,
    limit: data?.limit ?? params.limit ?? 20,
    lastUpdated: data?.lastUpdated ?? null,
    isLoading,
    isError: Boolean(error || apiError),
    error: error || apiError,
    mutate,
  }
}
