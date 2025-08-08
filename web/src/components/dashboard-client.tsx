"use client"
import React, { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { MarketAreaChart } from './chart/market-area'
import { MetricCard } from './metric-card'
import { TopSubSectors, FundingByRegion } from './right-rail'
import type { DashboardData } from '../lib/api'
import { DataStatus } from './data-status'
import { FundingEventsList } from './funding-events-list'

export function DashboardClient({ data }: { data: DashboardData }) {
  const [query, setQuery] = useState('')

  const filteredSubSectors = useMemo(() => {
    if (!query) return data.subSectors
    const q = query.toLowerCase()
    return data.subSectors.filter((s) => s.name.toLowerCase().includes(q))
  }, [data.subSectors, query])

  const filteredRegions = useMemo(() => {
    if (!query) return data.regions
    const q = query.toLowerCase()
    return data.regions.filter((r) => r.name.toLowerCase().includes(q))
  }, [data.regions, query])

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
          <span className="ml-auto text-xs text-[color:var(--fg-muted)] flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#FF0404]"></span> live updating
          </span>
        </label>
        <div className="mt-2 flex justify-end">
          <DataStatus />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          <div>
            <div className="text-2xl font-medium">Market Report</div>
            <div className="text-sm text-[color:var(--fg-muted)]">An overview of financial performance</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <MetricCard label="Total Funding" value={data.metrics.totalFunding} subtitle="Last updated 5 mins ago" delta="3.4%" />
            <MetricCard label="Highest Sector" value={data.metrics.highestSector} subtitle="Last updated 5 mins ago" delta="10.7%" />
            <MetricCard label="Most Active Investor" value={data.metrics.mostActiveInvestor} subtitle="Last updated 5 mins ago" delta="21.7%" />
          </div>

          <MarketAreaChart data={data.cashflow} />

          {/* Live data list from API */}
          <FundingEventsList q={query} limit={10} />
        </div>

        <aside className="space-y-10">
          <TopSubSectors
            items={filteredSubSectors}
            onSelect={(name) => setQuery(name)}
          />
          <FundingByRegion
            items={filteredRegions}
            onSelect={(name) => setQuery(name)}
          />
        </aside>
      </div>
    </div>
  )
}
