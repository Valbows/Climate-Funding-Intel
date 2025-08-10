/** @jest-environment node */

import { Request as URequest, Headers as UHeaders, Response as UResponse } from 'undici'

let POST: (req: any, ctx: { params: { slug: string } }) => Promise<Response>

beforeAll(async () => {
  // Polyfill web fetch APIs for Next server modules when running on older Node
  // @ts-ignore
  globalThis.Request = URequest as any
  // @ts-ignore
  globalThis.Headers = UHeaders as any
  // @ts-ignore
  globalThis.Response = UResponse as any

  const mod = await import('@/app/api/companies/[slug]/enrich/route')
  POST = mod.POST as any
})

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers,
  })
}

describe('POST /api/companies/[slug]/enrich (stub mode)', () => {
  const OLD_ENV = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD_ENV }
    process.env.ENRICH_RUNNER_ENABLED = 'false'
    delete process.env.ENRICH_ADMIN_TOKEN
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('returns 202 and mode stub when runner disabled', async () => {
    const req = makeRequest('http://localhost/api/companies/test-co/enrich', {
      'x-forwarded-for': '127.0.0.1',
    })
    const res = await POST(req as any, { params: { slug: 'test-co' } })
    expect(res.status).toBe(202)
    const body = await (res as Response).json()
    expect(body).toMatchObject({ queued: true, slug: 'test-co', mode: 'stub' })
  })

  it('enforces admin token when set', async () => {
    process.env.ENRICH_ADMIN_TOKEN = 'secret'
    const req = makeRequest('http://localhost/api/companies/auth-co/enrich', {
      'x-forwarded-for': '127.0.0.1',
    })
    const res = await POST(req as any, { params: { slug: 'auth-co' } })
    expect(res.status).toBe(401)
  })

  it('rate limits per IP+slug within window', async () => {
    const headers = { 'x-forwarded-for': '10.0.0.1' }
    const req1 = makeRequest('http://localhost/api/companies/rl-co/enrich', headers)
    const r1 = await POST(req1 as any, { params: { slug: 'rl-co' } })
    expect(r1.status).toBe(202)

    const req2 = makeRequest('http://localhost/api/companies/rl-co/enrich', headers)
    const r2 = await POST(req2 as any, { params: { slug: 'rl-co' } })
    expect(r2.status).toBe(429)
    const body2 = await (r2 as Response).json()
    expect(body2).toHaveProperty('retryAfterSeconds')
  })
})
