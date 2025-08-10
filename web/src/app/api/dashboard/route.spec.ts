/** @jest-environment node */

import { Response as UResponse, Headers as UHeaders } from 'undici'

// Mutable mock data that tests can update between assertions
let mockData: Array<{
  amount_raised_usd: number | null
  sub_sector: string | null
  geography: string | null
  lead_investor: string | null
  funding_date: string | null
  created_at?: string | null
}> = []

// Mock Supabase server client used by the route
jest.mock('@/lib/supabaseServer', () => {
  return {
    getSupabaseServer: () => ({
      from: (_table: string) => ({
        select: (_cols: string) => ({
          order: (_col: string, _opts: any) => ({
            limit: async (_n: number) => ({ data: mockData, error: null }),
          }),
        }),
      }),
    }),
  }
})

let GET: (req: any) => Promise<Response>

beforeAll(async () => {
  // Polyfill web fetch APIs for Next server modules when running in Jest
  // @ts-ignore
  globalThis.Headers = UHeaders as any
  // @ts-ignore
  globalThis.Response = UResponse as any

  const mod = await import('@/app/api/dashboard/route')
  GET = mod.GET as any
})

describe('GET /api/dashboard', () => {
  const hour = 60 * 60 * 1000
  const day = 24 * hour

  beforeEach(() => {
    mockData = []
  })

  it('uses created_at fallback for lastUpdatedRel when funding_date is missing', async () => {
    mockData = [
      {
        amount_raised_usd: 0,
        sub_sector: null,
        geography: null,
        lead_investor: null,
        funding_date: null, // intentionally missing
        created_at: new Date(Date.now() - 2 * hour).toISOString(),
      },
    ]

    const res = await GET({} as any)
    expect(res.status).toBe(200)
    const body = (await (res as Response).json()) as any
    expect(typeof body?.metrics?.lastUpdatedRel).toBe('string')
    expect(body.metrics.lastUpdatedRel).toBe('2 hours ago')
  })

  it('computes totalFundingDelta between current and previous 30-day windows', async () => {
    mockData = [
      // Current window (last 30 days): 100
      {
        amount_raised_usd: 100,
        sub_sector: 'EV',
        geography: 'US',
        lead_investor: 'A',
        funding_date: new Date(Date.now() - 1 * day).toISOString(),
        created_at: new Date(Date.now() - 1 * day).toISOString(),
      },
      // Previous window (30-60 days): 50
      {
        amount_raised_usd: 50,
        sub_sector: 'EV',
        geography: 'US',
        lead_investor: 'A',
        funding_date: new Date(Date.now() - 40 * day).toISOString(),
        created_at: new Date(Date.now() - 40 * day).toISOString(),
      },
    ]

    const res = await GET({} as any)
    const body = (await (res as Response).json()) as any
    expect(body.metrics.totalFundingDelta).toBeCloseTo(100, 5)
  })
})
