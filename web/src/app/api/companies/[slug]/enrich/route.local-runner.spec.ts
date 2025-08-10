/** @jest-environment node */

import { Request as URequest, Headers as UHeaders, Response as UResponse } from 'undici'

function makeRequest(url: string, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers,
  })
}

describe('POST /api/companies/[slug]/enrich (local-runner mode)', () => {
  const OLD_ENV = process.env
  let POST: (req: any, ctx: { params: { slug: string } }) => Promise<Response>
  let spawn: jest.Mock

  beforeEach(async () => {
    jest.resetModules()
    jest.clearAllMocks()
    process.env = { ...OLD_ENV }

    // enable runner
    process.env.ENRICH_RUNNER_ENABLED = 'true'

    // polyfill fetch spec types
    // @ts-ignore
    globalThis.Request = URequest as any
    // @ts-ignore
    globalThis.Headers = UHeaders as any
    // @ts-ignore
    globalThis.Response = UResponse as any

    // Re-apply mock after resetModules, before importing route
    jest.doMock('child_process', () => ({
      spawn: jest.fn(() => ({ unref: jest.fn() })),
    }))
    ;({ spawn } = require('child_process'))

    const mod = await import('@/app/api/companies/[slug]/enrich/route')
    POST = mod.POST as any
  })

  afterAll(() => {
    process.env = OLD_ENV
  })

  it('spawns python runner and returns mode local-runner', async () => {
    const slug = 'spawn-co'
    const req = makeRequest(`http://localhost/api/companies/${slug}/enrich`, {
      'x-forwarded-for': '127.0.0.1',
    })

    const res = await POST(req as any, { params: { slug } })
    expect(res.status).toBe(202)
    const body = await (res as Response).json()
    expect(body).toMatchObject({ queued: true, slug, mode: 'local-runner' })

    expect(spawn).toHaveBeenCalledTimes(1)
    const args = spawn.mock.calls[0]
    expect(args[0]).toBe(process.env.ENRICH_RUNNER_PYTHON || 'python')
    expect(args[1]).toEqual(['-m', 'pipeline.enrich_company', '--slug', slug])
    const opts = args[2]
    expect(opts).toMatchObject({ detached: true, stdio: 'ignore' })
  })
})
