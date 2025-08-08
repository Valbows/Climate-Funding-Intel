"use client"
import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then((r) => r.json())

export function DataStatus() {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  // Skip fetching when Supabase envs are not configured (keeps unit tests quiet)
  const { data, error, isLoading } = useSWR(
    hasSupabase ? '/api/funding-events?limit=1' : null,
    fetcher,
    { revalidateOnFocus: false }
  )

  if (!hasSupabase) return null

  return (
    <div data-testid="data-status" className="text-xs text-[color:var(--fg-muted)]">
      {isLoading && <span>Loading live data…</span>}
      {error && <span role="alert">Failed to load live data</span>}
      {!isLoading && !error && data && (
        <span>
          <span data-testid="data-count">{data.count ?? 0} events</span>
          <span className="mx-2">•</span>
          <span data-testid="data-last-updated">Last updated {data.lastUpdated}</span>
        </span>
      )}
    </div>
  )
}
