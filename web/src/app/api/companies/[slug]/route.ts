import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabaseServer'
import { unslugify } from '@/lib/slug'

function formatAmount(n: number | null | undefined) {
  if (n == null) return 0
  return typeof n === 'number' ? n : Number(n) || 0
}

export async function GET(_req: NextRequest, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug
  const name = unslugify(slug)

  let events: any[] = []
  try {
    const supabase = getSupabaseServer()
    const like = `%${name}%`
    const { data, error } = await supabase
      .from('funding_events')
      .select('*')
      .ilike('startup_name', like)
      .order('funding_date', { ascending: false })
      .limit(200)

    if (error) {
      return NextResponse.json({
        company: { name, slug, bio: null, bio_status: 'absent' },
        events: [],
        totalRaised: 0,
        lastRound: null,
        lastRoundDate: null,
        sources: [],
        error: error.message,
      }, { status: 200 })
    }

    events = data || []
  } catch (e: any) {
    return NextResponse.json({
      company: { name, slug, bio: null, bio_status: 'absent' },
      events: [],
      totalRaised: 0,
      lastRound: null,
      lastRoundDate: null,
      sources: [],
      error: e?.message || 'Supabase not configured',
    }, { status: 200 })
  }

  const totalRaised = events.reduce((sum, e) => sum + formatAmount(e.amount_raised_usd ?? e.amount_usd ?? null), 0)
  const last = events[0]
  const lastRound = last?.funding_round ?? null
  const lastRoundDate = last?.funding_date ?? null
  const sources = Array.from(new Set(events.map((e) => e.source_url).filter(Boolean)))

  return NextResponse.json({
    company: { name: events[0]?.startup_name || name, slug, bio: null, bio_status: 'absent' },
    events,
    totalRaised,
    lastRound,
    lastRoundDate,
    sources,
    error: null,
  }, { status: 200 })
}
