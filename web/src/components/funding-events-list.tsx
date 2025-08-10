"use client"
import React from 'react'
import Link from 'next/link'
import { useFundingEvents, type FundingEvent } from '@/lib/useFundingEvents'
import { slugify } from '@/lib/slug'

export type FundingEventsListProps = {
  q?: string
  sub_sector?: string
  investor?: string
  from?: string
  to?: string
  page?: number
  limit?: number
  enabled?: boolean
}

function formatAmount(n: number | null | undefined) {
  if (n == null) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  } catch {
    return `$${n}`
  }
}

function formatDate(s?: string) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString()
}

export function FundingEventsList(props: FundingEventsListProps) {
  const { q, sub_sector, investor, from, to, page = 1, limit = 10, enabled } = props
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const isEnabled = typeof enabled === 'boolean' ? enabled : hasSupabase
  const [currentPage, setCurrentPage] = React.useState<number>(page)
  // Reset or sync pagination when inputs change
  React.useEffect(() => {
    setCurrentPage(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])
  React.useEffect(() => {
    setCurrentPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sub_sector, investor, from, to, limit])
  const { events, isLoading, isError, error, count } = useFundingEvents({ q, sub_sector, investor, from, to, page: currentPage, limit }, isEnabled)
  const totalPages = Math.max(1, Math.ceil((count || 0) / limit))
  const canPrev = currentPage > 1
  const canNext = currentPage < totalPages

  return (
    <section aria-labelledby="funding-events-title" data-testid="funding-events">
      <div className="flex items-end justify-between mb-2">
        <div>
          <h2 id="funding-events-title" className="text-lg font-medium text-[color:var(--accent)]">Recent Funding Events: Last 30 Days</h2>
          <p className="text-xs text-[color:var(--fg-muted)]">{count} total</p>
        </div>
      </div>

      {!isEnabled && (
        <div data-testid="fe-disabled" className="text-sm text-[color:var(--fg-muted)]">Live data disabled</div>
      )}

      {isEnabled && isLoading && (
        <div data-testid="fe-loading" className="text-sm text-[color:var(--fg-muted)]">Loading funding events…</div>
      )}

      {isEnabled && isError && (
        <div role="alert" data-testid="fe-error" className="text-sm text-red-600">{error?.message || 'Failed to load funding events'}</div>
      )}

      {isEnabled && !isLoading && !isError && events.length === 0 && (
        <div data-testid="fe-empty" className="text-sm text-[color:var(--fg-muted)]">No funding events found</div>
      )}

      {isEnabled && !isLoading && !isError && events.length > 0 && (
        <ul className="divide-y divide-[color:var(--border)] rounded border border-[color:var(--border)] overflow-hidden">
          {events.map((e: FundingEvent, idx: number) => {
            const name = e.startup_name || 'unknown'
            const slug = slugify(name)
            return (
              <li key={e.id ?? idx} className="text-sm">
                <Link
                  href={`/companies/${slug}`}
                  className="px-4 py-3 flex items-center gap-4 block hover:bg-[color:var(--muted)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate" title={e.startup_name || ''}>{e.startup_name || 'Unknown'}</div>
                    <div className="text-xs text-[color:var(--fg-muted)] truncate">
                      <span>{e.sub_sector || '—'}</span>
                      <span className="mx-2">•</span>
                      <span>{e.geography || '—'}</span>
                      <span className="mx-2">•</span>
                      <span>{formatDate(e.funding_date)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-xs whitespace-nowrap">{formatAmount((e as any).amount_raised_usd ?? (e as any).amount_usd ?? null)}</div>
                    {e.source_url && (
                      <span
                        onClick={(evt) => { evt.preventDefault(); evt.stopPropagation(); window.open(e.source_url!, '_blank', 'noopener,noreferrer') }}
                        title="View source"
                        aria-label="View source"
                        className="inline-flex items-center justify-center w-6 h-6 text-[color:var(--fg-muted)] hover:text-[color:var(--accent)]"
                        role="button"
                      >
                        ↗
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {isEnabled && !isLoading && !isError && (count || 0) >= 1 && (
        <div className="flex items-center justify-between mt-3" data-testid="fe-pagination">
          <div className="text-xs text-[color:var(--fg-muted)]">Page {currentPage} of {totalPages}</div>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <button
                type="button"
                aria-label="Previous"
                className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                disabled={!canPrev}
                onClick={() => canPrev && setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                aria-label="Next"
                className="px-2 py-1 text-xs border rounded disabled:opacity-50"
                disabled={!canNext}
                onClick={() => canNext && setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
