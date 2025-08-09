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
  let companyBio: string | null = null
  let bioStatus: 'ready' | 'pending' | 'absent' = 'absent'
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
      }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
    }

    events = data || []
    // Attempt to read company bio if `companies` table exists (ignore errors)
    try {
      const { data: companyRow, error: companyErr } = await supabase
        .from('companies')
        .select('bio, name, website, last_enriched_at, updated_at')
        .eq('slug', slug)
        .maybeSingle()

      if (!companyErr && companyRow) {
        companyBio = companyRow.bio ?? null
        bioStatus = companyBio ? 'ready' : 'pending'
      }
    } catch {
      // table may not exist yet; keep defaults
    }
  } catch (e: any) {
    return NextResponse.json({
      company: { name, slug, bio: null, bio_status: 'absent' },
      events: [],
      totalRaised: 0,
      lastRound: null,
      lastRoundDate: null,
      sources: [],
      error: e?.message || 'Supabase not configured',
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
  }

  const totalRaised = events.reduce((sum, e) => sum + formatAmount(e.amount_raised_usd ?? e.amount_usd ?? null), 0)
  const last = events[0]
  const lastRound = last?.funding_round ?? null
  const lastRoundDate = last?.funding_date ?? null
  const sources = Array.from(new Set(events.map((e) => e.source_url).filter(Boolean)))

  const cacheControl = bioStatus === 'pending'
    ? 'no-store'
    : 'public, max-age=30, stale-while-revalidate=120'

  return NextResponse.json({
    company: { name: events[0]?.startup_name || name, slug, bio: companyBio, bio_status: bioStatus },
    events,
    totalRaised,
    lastRound,
    lastRoundDate,
    sources,
    error: null,
  }, { status: 200, headers: { 'Cache-Control': cacheControl } })
}

// Stub endpoint for queueing enrichment. In this MVP it returns 202 without side effects.
export async function POST(_req: NextRequest, ctx: { params: { slug: string } }) {
  const slug = ctx.params.slug
  // In a future iteration, this will enqueue a background job using a server key.
  return NextResponse.json({ queued: true, slug }, { status: 202 })
}
