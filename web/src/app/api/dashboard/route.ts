import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

function fmtDollars(n: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  } catch {
    return `$${n}`
  }
}

export async function GET(_req: NextRequest) {
  try {
    const supabase = getSupabaseServer()

    const { data: all, error } = await supabase
      .from('funding_events')
      .select('amount_raised_usd, sub_sector, geography, lead_investor, funding_date')
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
    }>

    // Metrics
    const amounts = events.map((e) => e.amount_raised_usd || 0)
    const total = amounts.reduce((a, b) => a + b, 0)

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
      // by month
      const d = (e.funding_date || '').slice(0, 7) // YYYY-MM
      if (d) monthSums.set(d, (monthSums.get(d) || 0) + (e.amount_raised_usd || 0))
      // by region
      const geo = (e.geography || '').trim()
      if (geo) regionSums.set(geo, (regionSums.get(geo) || 0) + (e.amount_raised_usd || 0))
    }

    const highestSector = Array.from(sectorSums.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'
    const mostActiveInvestor = Array.from(investorCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

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
      pct: total > 0 ? Math.round((sum / total) * 100) : 0,
      dollars: fmtDollars(sum),
    }))

    const regionsArr = Array.from(regionSums.entries()).sort((a, b) => b[1] - a[1])
    const topRegions = regionsArr.slice(0, 3)
    const regionPalette = ['#B0FE09', '#E12B9A', '#48D38A']
    const regions = topRegions.map(([name, sum], i) => ({
      name,
      pct: total > 0 ? Math.round((sum / total) * 100) : 0,
      dollars: fmtDollars(sum),
      color: regionPalette[i % regionPalette.length],
    }))

    return NextResponse.json({
      metrics: {
        totalFunding: fmtDollars(total),
        highestSector,
        mostActiveInvestor,
      },
      cashflow,
      subSectors,
      regions,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Unknown error' }, { status: 200 })
  }
}
