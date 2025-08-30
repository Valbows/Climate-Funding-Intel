"use client"
import React, { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { MarketAreaChart } from './chart/market-area'
import { MetricCard } from './metric-card'
import { TopSubSectors, FundingByRegion } from './right-rail'
import type { DashboardData } from '../lib/api'
import { DataStatus } from './data-status'
import { FundingEventsList } from './funding-events-list'

export function DashboardClient({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState('')
  const [clientData, setClientData] = useState<DashboardData>(data)
  const [investorFilter, setInvestorFilter] = useState('')
  const [geoFilter, setGeoFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  // 90d window for aligning list with metric totals
  const window90d = useMemo(() => {
    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000
    const from = new Date(now.getTime() - 90 * dayMs).toISOString().slice(0, 10)
    const to = now.toISOString().slice(0, 10)
    return { from, to }
  }, [])

  // Listen for filter changes from Sidebar
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {}
      if (typeof detail.investor === 'string') setInvestorFilter(detail.investor)
      if (typeof detail.from === 'string') setFromDate(detail.from)
      if (typeof detail.to === 'string') setToDate(detail.to)
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('companies-filters-change', handler as EventListener)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('companies-filters-change', handler as EventListener)
      }
    }
  }, [])

  // Manual refresh handler (auto-refresh disabled)
  const [refreshing, setRefreshing] = useState(false)
  async function refreshMetrics() {
    try {
      setRefreshing(true)
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      if (!res.ok) return
      const json = (await res.json()) as DashboardData
      setClientData(json)
      // Notify other widgets to refresh on demand (e.g., DataStatus)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('manual-refresh'))
      }
    } finally {
      setRefreshing(false)
    }
  }

  const filteredSubSectors = useMemo(() => {
    if (!query) return clientData.subSectors
    const q = query.toLowerCase()
    return clientData.subSectors.filter((s) => s.name.toLowerCase().includes(q))
  }, [clientData.subSectors, query])

  const filteredRegions = useMemo(() => {
    if (!query) return clientData.regions
    const q = query.toLowerCase()
    return clientData.regions.filter((r) => r.name.toLowerCase().includes(q))
  }, [clientData.regions, query])

  return (
    <div className="container-frame py-6">
      <div className="mb-6">
        <label className="flex items-center gap-3 bg-[rgba(1,119,251,0.08)] border border-[rgba(1,119,251,0.35)] rounded px-5 py-4 w-full md:w-[640px]" htmlFor="dashboard-search">
          <Search size={18} />
          <input
            id="dashboard-search"
            placeholder="Search sectors or regions"
            className="bg-transparent outline-none w-full text-sm placeholder:text-[color:var(--fg-muted)]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="mt-2 flex justify-end">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refreshMetrics}
              disabled={refreshing}
              className="text-xs px-2 py-1 rounded border border-[color:var(--border)] disabled:opacity-50 hover:text-[color:var(--accent)]"
              aria-label="Refresh dashboard metrics"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <DataStatus />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <div>
            <div className="text-2xl font-medium">Market Report</div>
            <div className="text-sm text-[color:var(--fg-muted)]">An overview of financial performance</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard
              label="Total Funding (3 mo)"
              value={clientData.metrics.totalFunding}
              subtitle={`Last updated ${clientData.metrics.lastUpdatedRel}`}
              delta={clientData.metrics.totalFundingDelta}
            />
            <MetricCard
              label="Highest Sector"
              value={clientData.metrics.highestSector}
              subtitle={`Last updated ${clientData.metrics.lastUpdatedRel}`}
              delta={clientData.metrics.highestSectorDelta}
            />
            <MetricCard
              label="Most Active Investor"
              value={clientData.metrics.mostActiveInvestor}
              subtitle={`Last updated ${clientData.metrics.lastUpdatedRel}`}
              delta={clientData.metrics.mostActiveInvestorDelta}
            />
          </div>

          <MarketAreaChart data={clientData.cashflow} />

          {/* Live data list from API (aligned to 3-month window unless overridden by filters) */}
          <FundingEventsList
            q={query}
            geography={geoFilter}
            investor={investorFilter}
            limit={10}
            from={fromDate || window90d.from}
            to={toDate || window90d.to}
          />
        </div>

        <aside className="space-y-10">
          <TopSubSectors
            items={filteredSubSectors}
            onSelect={(name) => setQuery(name)}
          />
          <FundingByRegion
            items={filteredRegions}
            onSelect={(name) => {
              // Selecting a region sets dedicated geography filter, clears conflicting filters,
              // and mirrors the search box for user feedback
              setGeoFilter(name)
              setInvestorFilter('')
              setQuery(name)
            }}
          />
        </aside>
      </div>
    </div>
  )
}
