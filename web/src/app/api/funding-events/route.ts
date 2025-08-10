import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const subSector = (searchParams.get('sub_sector') || '').trim()
  const investor = (searchParams.get('investor') || '').trim()
  const from = (searchParams.get('from') || '').trim()
  const to = (searchParams.get('to') || '').trim()
  const page = Math.max(1, Number(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || '20')))
  const fromIdx = (page - 1) * limit
  const toIdx = fromIdx + limit - 1

  let supabase
  try {
    supabase = getSupabaseServer()
  } catch (e: any) {
    return NextResponse.json(
      {
        events: [],
        count: 0,
        page,
        limit,
        lastUpdated: new Date().toISOString(),
        error: 'Supabase not configured',
      },
      { status: 200 }
    )
  }

  try {
    let query = supabase.from('funding_events').select('*', { count: 'exact' })

    if (q) {
      const like = `%${q}%`
      query = query.or(
        `startup_name.ilike.${like},sub_sector.ilike.${like},geography.ilike.${like}`
      )
    }

    if (subSector) {
      query = query.eq('sub_sector', subSector)
    }

    if (investor) {
      const likeInv = `%${investor}%`
      query = query.ilike('lead_investor', likeInv)
    }

    if (from || to) {
      // Apply canonical date window: (funding_date between from/to) OR (funding_date is null AND created_at between from/to)
      const ors: string[] = []
      if (from && to) {
        ors.push(`and(funding_date.gte.${from},funding_date.lte.${to})`)
        ors.push(`and(funding_date.is.null,created_at.gte.${from},created_at.lte.${to})`)
      } else if (from) {
        ors.push(`funding_date.gte.${from}`)
        ors.push(`and(funding_date.is.null,created_at.gte.${from})`)
      } else if (to) {
        ors.push(`funding_date.lte.${to}`)
        ors.push(`and(funding_date.is.null,created_at.lte.${to})`)
      }
      query = query.or(ors.join(','))
    }

    const { data, count, error } = await query
      .order('funding_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(fromIdx, toIdx)

    if (error) {
      return NextResponse.json(
        {
          events: [],
          count: 0,
          page,
          limit,
          lastUpdated: new Date().toISOString(),
          error: error.message,
        },
        { status: 200 }
      )
    }

    return NextResponse.json(
      {
        events: data ?? [],
        count: count ?? 0,
        page,
        limit,
        lastUpdated: new Date().toISOString(),
        error: null,
      },
      { status: 200 }
    )
  } catch (err: any) {
    return NextResponse.json(
      {
        events: [],
        count: 0,
        page,
        limit,
        lastUpdated: new Date().toISOString(),
        error: err?.message || 'Unknown error',
      },
      { status: 200 }
    )
  }
}
