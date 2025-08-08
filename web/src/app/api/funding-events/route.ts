import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const subSector = (searchParams.get('sub_sector') || '').trim()
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

    if (from) {
      query = query.gte('funding_date', from)
    }

    if (to) {
      query = query.lte('funding_date', to)
    }

    const { data, count, error } = await query.order('funding_date', { ascending: false }).range(fromIdx, toIdx)

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
