import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

// Ensure Node.js runtime (required for child_process)
export const runtime = 'nodejs'

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

  // Option A: Dev-only local runner (spawn Python) behind env flag.
  const enabled = String(process.env.ENRICH_RUNNER_ENABLED || '').toLowerCase() === 'true'
  if (enabled) {
    const pythonCmd = process.env.ENRICH_RUNNER_PYTHON || 'python'
    const runnerCwd = process.env.ENRICH_RUNNER_CWD || path.resolve(process.cwd(), '..')
    try {
      const child = spawn(pythonCmd, ['-m', 'pipeline.enrich_company', '--slug', slug], {
        cwd: runnerCwd,
        env: { ...process.env },
        stdio: 'ignore',
        detached: true,
      })
      // Detach from event loop; do not await completion
      child.unref()
      return NextResponse.json(
        { queued: true, slug, mode: 'local-runner' },
        { status: 202, headers: { 'Cache-Control': 'no-store' } }
      )
    } catch (err) {
      const msg = (err as Error)?.message || 'spawn_failed'
      const body: Record<string, unknown> = { queued: false, error: 'runner_spawn_failed' }
      if (process.env.NODE_ENV !== 'production') body.details = msg
      return NextResponse.json(body, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  // Default: return 202 Accepted stub (no side effects) when runner disabled.
  return NextResponse.json(
    { queued: true, slug, mode: 'stub' },
    { status: 202, headers: { 'Cache-Control': 'no-store' } }
  )
}
