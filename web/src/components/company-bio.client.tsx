"use client"

import useSWR from 'swr'
import React from 'react'

type CompanyApiResponse = {
  company: { name: string; slug: string; bio: string | null; bio_status: 'ready' | 'pending' | 'absent' }
  events: any[]
  totalRaised: number
  lastRound: string | null
  lastRoundDate: string | null
  sources: string[]
  error: string | null
}

const fetcher = (url: string) => fetch(url).then((r) => r.json() as Promise<CompanyApiResponse>)

export function CompanyBio({ slug }: { slug: string }) {
  const { data, isLoading, mutate } = useSWR<CompanyApiResponse>(`/api/companies/${slug}`, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: (latestData) => (latestData?.company?.bio_status === 'pending' ? 5000 : 0),
  })

  const status = data?.company?.bio_status ?? 'absent'
  const bio = data?.company?.bio ?? null

  async function requestEnrichment() {
    try {
      await fetch(`/api/companies/${slug}/enrich`, { method: 'POST' })
      // Optimistically set to pending and trigger revalidation
      await mutate()
    } catch {}
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[color:var(--accent)]">Company Bio</h2>
        {status !== 'ready' && (
          <button
            type="button"
            onClick={requestEnrichment}
            className="text-xs px-2 py-1 rounded border border-[color:var(--border)] hover:text-[color:var(--accent)]"
            aria-label="Request enrichment"
          >
            Fetch Bio
          </button>
        )}
      </div>
      {isLoading && <div className="text-sm text-[color:var(--fg-muted)]">Loading bio…</div>}
      {!isLoading && status === 'ready' && bio && (
        <div className="text-sm leading-6 whitespace-pre-wrap">{bio}</div>
      )}
      {!isLoading && status !== 'ready' && (
        <div className="text-sm text-[color:var(--fg-muted)]">
          {status === 'pending' ? 'Bio is being prepared…' : 'No bio available yet.'}
        </div>
      )}
    </section>
  )}
