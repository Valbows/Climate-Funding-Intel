import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory rate limiter (per-IP + slug), suitable for dev/staging only.
const WINDOW_MS = 60_000 // 60 seconds
const lastCalls = new Map<string, number>()

function clientKey(req: NextRequest, slug: string) {
  const xff = req.headers.get('x-forwarded-for') || ''
  const ip = xff.split(',')[0].trim() || 'unknown'
  return `${ip}:${slug}`
}

export async function POST(req: NextRequest, ctx: { params: { slug: string } }) {
  const { slug } = ctx.params

  // Optional admin token enforcement. If set, require header `x-admin-token` to match.
  const requiredToken = process.env.ENRICH_ADMIN_TOKEN
  if (requiredToken) {
    const provided = req.headers.get('x-admin-token') || ''
    if (provided !== requiredToken) {
      return NextResponse.json(
        { queued: false, error: 'unauthorized' },
        { status: 401, headers: { 'Cache-Control': 'no-store' } }
      )
    }
  }

  // Rate limiting
  const key = clientKey(req, slug)
  const now = Date.now()
  const last = lastCalls.get(key) || 0
  if (now - last < WINDOW_MS) {
    const retry = Math.ceil((WINDOW_MS - (now - last)) / 1000)
    return NextResponse.json(
      { queued: false, retryAfterSeconds: retry },
      { status: 429, headers: { 'Cache-Control': 'no-store', 'Retry-After': String(retry) } }
    )
  }
  lastCalls.set(key, now)

  // TODO: Enqueue real enrichment job. For now, return 202 Accepted as a stub.
  return NextResponse.json(
    { queued: true, slug },
    { status: 202, headers: { 'Cache-Control': 'no-store' } }
  )
}
