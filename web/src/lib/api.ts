export type CashflowPoint = { month: string; revenue: number; expense: number }
export type SubSector = { name: string; pct: number; dollars: string }
export type RegionFunding = { name: string; pct: number; dollars: string; color?: string }

export type DashboardData = {
  metrics: {
    totalFunding: string
    highestSector: string
    mostActiveInvestor: string
    totalFundingDelta: number
    highestSectorDelta: number
    mostActiveInvestorDelta: number
    lastUpdatedRel: string
  }
  cashflow: CashflowPoint[]
  subSectors: SubSector[]
  regions: RegionFunding[]
}

const FALLBACK: DashboardData = {
  metrics: {
    totalFunding: '$59.79 B',
    highestSector: 'EV Charging',
    mostActiveInvestor: 'Peak Capital',
    totalFundingDelta: 0,
    highestSectorDelta: 0,
    mostActiveInvestorDelta: 0,
    lastUpdatedRel: 'unknown',
  },
  cashflow: [
    { month: 'January', revenue: 1200, expense: 600 },
    { month: 'February', revenue: 1400, expense: 800 },
    { month: 'March', revenue: 1800, expense: 900 },
    { month: 'April', revenue: 2000, expense: 1100 },
    { month: 'June', revenue: 2400, expense: 1300 },
    { month: 'July', revenue: 2600, expense: 1600 },
  ],
  subSectors: [
    { name: 'EV Charging', pct: 20, dollars: '$8,500' },
    { name: 'Energy Storage', pct: 19, dollars: '$7,900' },
    { name: 'Grid Modernization', pct: 18, dollars: '$7,500' },
    { name: 'Renewable Integration', pct: 17, dollars: '$7,200' },
    { name: 'Smart Metering', pct: 15, dollars: '$6,750' },
  ],
  regions: [
    { name: 'U.S.A', pct: 31, dollars: '$5.79 bn', color: '#B0FE09' },
    { name: 'Singapore', pct: 23, dollars: '$3.7 bn', color: '#E12B9A' },
    { name: 'Nigeria', pct: 21, dollars: '$3.21 bn', color: '#48D38A' },
  ],
}

import { headers } from 'next/headers'

export async function getDashboardData(): Promise<DashboardData> {
  const baseEnv = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL
  let url: string
  if (baseEnv) {
    url = `${baseEnv}/dashboard`
  } else if (typeof window === 'undefined') {
    // Server-side: build absolute URL from headers (works in dev and prod)
    try {
      const h = headers()
      const host = h.get('host') || 'localhost:3000'
      const proto = h.get('x-forwarded-proto') || 'http'
      url = `${proto}://${host}/api/dashboard`
    } catch {
      // Fallback for non-request contexts
      url = `http://localhost:3000/api/dashboard`
    }
  } else {
    // Client-side (shouldn't be used presently)
    url = `/api/dashboard`
  }

  try {
    // Use dynamic fetch to avoid serving cached fallback data in dev
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return FALLBACK
    const data = (await res.json()) as Partial<DashboardData>
    return {
      metrics: {
        totalFunding: data?.metrics?.totalFunding ?? FALLBACK.metrics.totalFunding,
        highestSector: data?.metrics?.highestSector ?? FALLBACK.metrics.highestSector,
        mostActiveInvestor: data?.metrics?.mostActiveInvestor ?? FALLBACK.metrics.mostActiveInvestor,
        totalFundingDelta: typeof data?.metrics?.totalFundingDelta === 'number' ? data.metrics.totalFundingDelta : FALLBACK.metrics.totalFundingDelta,
        highestSectorDelta: typeof data?.metrics?.highestSectorDelta === 'number' ? data.metrics.highestSectorDelta : FALLBACK.metrics.highestSectorDelta,
        mostActiveInvestorDelta: typeof data?.metrics?.mostActiveInvestorDelta === 'number' ? data.metrics.mostActiveInvestorDelta : FALLBACK.metrics.mostActiveInvestorDelta,
        lastUpdatedRel: data?.metrics?.lastUpdatedRel ?? FALLBACK.metrics.lastUpdatedRel,
      },
      cashflow: data?.cashflow?.length ? data.cashflow : FALLBACK.cashflow,
      subSectors: data?.subSectors?.length ? data.subSectors : FALLBACK.subSectors,
      regions: data?.regions?.length ? data.regions : FALLBACK.regions,
    }
  } catch {
    return FALLBACK
  }
}
