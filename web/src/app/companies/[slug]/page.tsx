import React from 'react'
import Link from 'next/link'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { unslugify } from '@/lib/slug'
import { CompanyBio } from '@/components/company-bio.client'

function formatAmount(n: number | null | undefined) {
  if (n == null) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  } catch {
    return `$${n}`
  }
}

function formatDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? s : d.toLocaleDateString()
}

export default async function CompanyPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const name = unslugify(slug)

  let events: any[] = []
  let error: string | null = null

  try {
    const supabase = getSupabaseServer()
    // Use ilike search to match variations of the startup name
    const like = `%${name}%`
    const { data, error: qErr } = await supabase
      .from('funding_events')
      .select('*')
      .ilike('startup_name', like)
      .order('funding_date', { ascending: false })
      .limit(200)

    if (qErr) {
      error = qErr.message
    } else {
      events = data || []
    }
  } catch (e: any) {
    // Supabase not configured in env
    error = e?.message || 'Supabase not configured'
  }

  const primaryName = events[0]?.startup_name || name
  const totalRaised = events.reduce((sum, e) => sum + (typeof e.amount_raised_usd === 'number' ? e.amount_raised_usd : 0), 0)
  const lastEvent = events[0]

  return (
    <div className="min-h-screen flex">
      <main className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">{primaryName}</h1>
            <p className="text-sm text-[color:var(--fg-muted)]">Company Overview</p>
          </div>
          <Link href="/" className="text-sm underline hover:text-[color:var(--accent)]">← Back</Link>
        </div>

        {error && (
          <div role="alert" className="text-sm text-red-500 border border-red-500/40 rounded p-3">{error}</div>
        )}

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded border border-[color:var(--border)] p-4">
            <div className="text-xs text-[color:var(--fg-muted)]">Total Raised</div>
            <div className="text-lg font-medium text-[color:var(--accent)]">{formatAmount(totalRaised)}</div>
          </div>
          <div className="rounded border border-[color:var(--border)] p-4">
            <div className="text-xs text-[color:var(--fg-muted)]">Last Round</div>
            <div className="text-lg font-medium">{lastEvent?.funding_round || '—'}</div>
          </div>
          <div className="rounded border border-[color:var(--border)] p-4">
            <div className="text-xs text-[color:var(--fg-muted)]">Last Funding Date</div>
            <div className="text-lg font-medium">{formatDate(lastEvent?.funding_date)}</div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-medium text-[color:var(--accent)]">Recent Events</h2>
          {events.length === 0 ? (
            <div className="text-sm text-[color:var(--fg-muted)]">No events found for “{name}”.</div>
          ) : (
            <ul className="divide-y divide-[color:var(--border)] rounded border border-[color:var(--border)] overflow-hidden">
              {events.map((e) => (
                <li key={e.id ?? `${e.startup_name}-${e.funding_date}-${e.amount_raised_usd}`}> 
                  <div className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate" title={e.startup_name || ''}>{e.funding_round || 'Funding'}</div>
                      <div className="text-xs text-[color:var(--fg-muted)] truncate">
                        <span>{e.sub_sector || '—'}</span>
                        <span className="mx-2">•</span>
                        <span>{e.geography || '—'}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDate(e.funding_date)}</span>
                        {e.lead_investor && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Lead: {e.lead_investor}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-mono text-xs whitespace-nowrap">{formatAmount(e.amount_raised_usd ?? e.amount_usd ?? null)}</div>
                      {e.source_url && (
                        <a
                          href={e.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="View source"
                          aria-label="View source"
                          className="inline-flex items-center justify-center w-6 h-6 text-[color:var(--fg-muted)] hover:text-[color:var(--accent)]"
                        >
                          ↗
                        </a>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Company Bio (client) */}
        <CompanyBio slug={slug} />
      </main>
    </div>
  )
}
