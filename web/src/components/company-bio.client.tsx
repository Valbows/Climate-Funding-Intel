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

  const [toast, setToast] = React.useState<{ text: string; tone: 'info' | 'success' | 'error' } | null>(null)
  React.useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(t)
  }, [toast])

  async function requestEnrichment() {
    try {
      const res = await fetch(`/api/companies/${slug}/enrich`, { method: 'POST' })
      let mode: string | undefined
      try {
        const body = await res.json()
        mode = body?.mode
      } catch {}
      if (res.ok) {
        if (mode === 'local-runner') {
          setToast({ text: 'Enrichment queued (local runner).', tone: 'success' })
        } else if (mode === 'stub') {
          setToast({ text: 'Request acknowledged (stub mode).', tone: 'info' })
        } else {
          setToast({ text: 'Request acknowledged.', tone: 'info' })
        }
      } else if (res.status === 429) {
        setToast({ text: 'Rate limited. Please retry shortly.', tone: 'error' })
      } else if (res.status === 401) {
        setToast({ text: 'Unauthorized to run enrichment.', tone: 'error' })
      } else {
        setToast({ text: 'Failed to queue enrichment.', tone: 'error' })
      }
      // Optimistically set to pending and trigger revalidation
      await mutate()
    } catch {
      setToast({ text: 'Network error while requesting enrichment.', tone: 'error' })
    }
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
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={
            'mt-2 text-xs inline-block rounded px-2 py-1 ' +
            (toast.tone === 'success'
              ? 'bg-green-900/30 text-green-200'
              : toast.tone === 'error'
              ? 'bg-red-900/30 text-red-200'
              : 'bg-zinc-800 text-zinc-200')
          }
        >
          {toast.text}
        </div>
      )}
    </section>
  )}
