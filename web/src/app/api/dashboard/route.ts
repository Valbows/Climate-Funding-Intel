import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

function fmtDollars(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n)
  } catch {
    return `$${n}`
  }
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = getSupabaseServer()

    const { data: all, error } = await supabase
      .from('funding_events')
      .select('amount_raised_usd, sub_sector, geography, lead_investor, funding_date, created_at')
      .order('funding_date', { ascending: false })
      .limit(2000)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 200 })
    }

    const events = (all || []).filter((e) => e.amount_raised_usd == null || typeof e.amount_raised_usd === 'number') as Array<{
      amount_raised_usd: number | null
      sub_sector: string | null
      geography: string | null
      lead_investor: string | null
      funding_date: string | null
      created_at?: string | null
    }>

    // Helper: parse date safely
    const parseDate = (s: string | null): Date | null => {
      if (!s) return null
      const d = new Date(s)
      return isNaN(d.getTime()) ? null : d
    }
    // Canonical event date: prefer funding_date, fallback to created_at
    const eventDate = (e: { funding_date: string | null; created_at?: string | null }): Date | null => {
      return parseDate(e.funding_date) ?? parseDate(e.created_at ?? null)
    }

    // Determine lastUpdated from the latest funding_date, falling back to created_at when funding_date is missing/invalid
    const latestDate: Date | null = (
      events
        .map((e) => {
          const fd = parseDate(e.funding_date)
          if (fd) return fd
          // Fallback to created_at if available
          return parseDate((e as any).created_at ?? null)
        })
        .filter((d): d is Date => !!d)
        .sort((a, b) => b.getTime() - a.getTime())[0]
    ) || null

    const now = new Date()
    const dayMs = 24 * 60 * 60 * 1000
    const currentStart = new Date(now.getTime() - 30 * dayMs)
    const prevStart = new Date(now.getTime() - 60 * dayMs)

    const inRange = (d: Date | null, start: Date, end: Date): boolean => {
      if (!d) return false
      return d >= start && d < end
    }

    const currEvents = events.filter((e) => inRange(eventDate(e), currentStart, now))
    const prevEvents = events.filter((e) => inRange(eventDate(e), prevStart, currentStart))

    const sumAmounts = (arr: typeof events) => arr.reduce((acc, e) => acc + (e.amount_raised_usd || 0), 0)

    const totalCurr = sumAmounts(currEvents)
    const totalPrev = sumAmounts(prevEvents)

    const pctDelta = (curr: number, prev: number): number => {
      if (prev <= 0 && curr > 0) return 100
      if (prev === 0 && curr === 0) return 0
      return ((curr - prev) / Math.max(prev, 1e-9)) * 100
    }

    // Overall totals (for shares/regions calculations)
    const totalAll = events.reduce((a, e) => a + (e.amount_raised_usd || 0), 0)

    const sectorSums = new Map<string, number>()
    const investorCounts = new Map<string, number>()
    const monthSums = new Map<string, number>()
    const regionSums = new Map<string, number>()

    for (const e of events) {
      // sectors by sum
      const sec = (e.sub_sector || '').trim()
      if (sec) {
        sectorSums.set(sec, (sectorSums.get(sec) || 0) + (e.amount_raised_usd || 0))
      }
      // investors by count
      const inv = (e.lead_investor || '').trim()
      if (inv) {
        investorCounts.set(inv, (investorCounts.get(inv) || 0) + 1)
      }
      // by month (use canonical event date)
      const dObj = eventDate(e)
      const d = dObj ? dObj.toISOString().slice(0, 7) : '' // YYYY-MM
      if (d) monthSums.set(d, (monthSums.get(d) || 0) + (e.amount_raised_usd || 0))
      // by region
      const geo = (e.geography || '').trim()
      if (geo) regionSums.set(geo, (regionSums.get(geo) || 0) + (e.amount_raised_usd || 0))
    }

    const highestSectorAll = Array.from(sectorSums.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

    // Compute current-window highest sector & investor for meaningful deltas
    const sectorSumsCurr = new Map<string, number>()
    const investorCountsCurr = new Map<string, number>()
    for (const e of currEvents) {
      const sec = (e.sub_sector || '').trim()
      if (sec) sectorSumsCurr.set(sec, (sectorSumsCurr.get(sec) || 0) + (e.amount_raised_usd || 0))
      const inv = (e.lead_investor || '').trim()
      if (inv) investorCountsCurr.set(inv, (investorCountsCurr.get(inv) || 0) + 1)
    }
    const highestSector = Array.from(sectorSumsCurr.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || highestSectorAll

    const mostActiveInvestor = Array.from(investorCountsCurr.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

    const months = Array.from(monthSums.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    const cashflow = months.slice(-6).map(([ym, sum]) => ({
      month: ym,
      revenue: sum,
      expense: Math.round(sum * 0.5),
    }))

    const subSectorsArr = Array.from(sectorSums.entries()).sort((a, b) => b[1] - a[1])
    const topSectors = subSectorsArr.slice(0, 5)
    const subSectors = topSectors.map(([name, sum]) => ({
      name,
      pct: totalAll > 0 ? Math.round((sum / totalAll) * 100) : 0,
      dollars: fmtDollars(sum),
    }))

    const regionsArr = Array.from(regionSums.entries()).sort((a, b) => b[1] - a[1])
    const topRegions = regionsArr.slice(0, 3)
    const regionPalette = ['#B0FE09', '#E12B9A', '#48D38A']
    const regions = topRegions.map(([name, sum], i) => ({
      name,
      pct: totalAll > 0 ? Math.round((sum / totalAll) * 100) : 0,
      dollars: fmtDollars(sum),
      color: regionPalette[i % regionPalette.length],
    }))

    // Deltas
    const totalFundingDelta = pctDelta(totalCurr, totalPrev)

    const sectorCurrSum = highestSector && highestSector !== '—' ? (sectorSumsCurr.get(highestSector) || 0) : 0
    // Compute previous-window sum for the same sector
    const sectorPrevSum = prevEvents.reduce((acc, e) => acc + ((e.sub_sector || '').trim() === highestSector ? (e.amount_raised_usd || 0) : 0), 0)
    const highestSectorDelta = pctDelta(sectorCurrSum, sectorPrevSum)

    const investorCurrCount = mostActiveInvestor && mostActiveInvestor !== '—' ? (investorCountsCurr.get(mostActiveInvestor) || 0) : 0
    const investorPrevCount = prevEvents.reduce((acc, e) => acc + ((e.lead_investor || '').trim() === mostActiveInvestor ? 1 : 0), 0)
    const mostActiveInvestorDelta = pctDelta(investorCurrCount, investorPrevCount)

    // lastUpdated relative string
    const relTime = (d: Date | null): string => {
      if (!d) return 'unknown'
      const diffMs = now.getTime() - d.getTime()
      const mins = Math.floor(diffMs / (60 * 1000))
      if (mins < 1) return 'just now'
      if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
      const days = Math.floor(hours / 24)
      return `${days} day${days === 1 ? '' : 's'} ago`
    }

    return NextResponse.json({
      metrics: {
        totalFunding: fmtDollars(totalCurr),
        highestSector,
        mostActiveInvestor,
        totalFundingDelta,
        highestSectorDelta,
        mostActiveInvestorDelta,
        lastUpdatedRel: relTime(latestDate),
      },
      cashflow,
      subSectors,
      regions,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 200 })
  }
}
