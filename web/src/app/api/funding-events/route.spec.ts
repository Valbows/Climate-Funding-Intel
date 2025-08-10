/** @jest-environment node */

import { Response as UResponse, Headers as UHeaders } from 'undici'

// Backing store for mocked rows returned by the query stub
let mockRows: Array<any> = []

// Mock Supabase server client used by the route, capturing query builder calls
jest.mock('@/lib/supabaseServer', () => {
  class QueryRecorder {
    public orCalls: string[] = []
    public ilikeCalls: Array<[string, string]> = []
    public eqCalls: Array<[string, any]> = []
    public orders: Array<[string, any]> = []
    public selected: { cols?: string; opts?: any } = {}

    select(cols: string, opts?: any) {
      this.selected = { cols, opts }
      return this
    }
    or(expr: string) {
      this.orCalls.push(expr)
      return this
    }
    ilike(col: string, val: string) {
      this.ilikeCalls.push([col, val])
      return this
    }
    eq(col: string, val: any) {
      this.eqCalls.push([col, val])
      return this
    }
    order(col: string, opts: any) {
      this.orders.push([col, opts])
      return this
    }
    async range(fromIdx: number, toIdx: number) {
      const slice = mockRows.slice(fromIdx, Math.min(toIdx + 1, mockRows.length))
      return { data: slice, count: mockRows.length, error: null }
    }
  }

  let lastRecorder: QueryRecorder | null = null

  return {
    getSupabaseServer: () => ({
      from: (_table: string) => {
        lastRecorder = new QueryRecorder()
        return lastRecorder as any
      },
    }),
    // Testing helpers exposed only from the mock
    __getRecorder: () => lastRecorder,
    __setMockRows: (rows: any[]) => {
      mockRows = rows
    },
  }
})

let GET: (req: any) => Promise<Response>

beforeAll(async () => {
  // Polyfill web fetch APIs for Next server modules when running in Jest
  // @ts-ignore
  globalThis.Headers = UHeaders as any
  // @ts-ignore
  globalThis.Response = UResponse as any

  const mod = await import('@/app/api/funding-events/route')
  GET = mod.GET as any
})

describe('GET /api/funding-events', () => {
  beforeEach(() => {
    mockRows = []
  })

  it('applies investor filter via ilike on lead_investor and paginates', async () => {
    const mocked = require('@/lib/supabaseServer') as any
    mocked.__setMockRows(
      Array.from({ length: 15 }).map((_, i) => ({
        id: `id-${i + 1}`,
        startup_name: `Item ${i + 1}`,
        sub_sector: 'EV',
        geography: 'US',
        lead_investor: i % 2 === 0 ? 'Tiger Global' : 'Sequoia',
        funding_date: `2025-01-${String((i % 28) + 1).padStart(2, '0')}`,
        created_at: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
        amount_raised_usd: 1000,
      }))
    )

    const res = await GET({ url: 'http://localhost/api/funding-events?investor=Tiger&page=2&limit=5' } as any)
    expect(res.status).toBe(200)
    const body = (await (res as Response).json()) as any

    // Validate pagination passthrough
    expect(body.page).toBe(2)
    expect(body.limit).toBe(5)
    expect(Array.isArray(body.events)).toBe(true)

    // Validate ilike called with correct args
    const mockedMod = require('@/lib/supabaseServer') as any
    const rec = mockedMod.__getRecorder()
    expect(rec).toBeTruthy()
    expect(rec.ilikeCalls).toContainEqual(['lead_investor', '%Tiger%'])

    // Validate ordering by funding_date and then created_at recorded
    const orderCols = rec.orders.map((o: any) => o[0])
    expect(orderCols).toEqual(['funding_date', 'created_at'])
  })

  it('applies canonical date window OR groups for from/to', async () => {
    const mocked = require('@/lib/supabaseServer') as any
    mocked.__setMockRows([
      {
        id: 'a',
        startup_name: 'Alpha',
        sub_sector: 'Solar',
        geography: 'US',
        lead_investor: 'T1',
        funding_date: '2025-01-15', // in range
        created_at: '2025-01-15T00:00:00Z',
        amount_raised_usd: 100,
      },
      {
        id: 'b',
        startup_name: 'Bravo',
        sub_sector: 'Wind',
        geography: 'DE',
        lead_investor: 'T2',
        funding_date: null, // funding_date missing, created_at used
        created_at: '2025-01-20T00:00:00Z', // in range
        amount_raised_usd: 200,
      },
      {
        id: 'c',
        startup_name: 'Charlie',
        sub_sector: 'Hydrogen',
        geography: 'UK',
        lead_investor: 'T3',
        funding_date: '2024-12-01', // out of range
        created_at: '2024-12-01T00:00:00Z',
        amount_raised_usd: 300,
      },
    ])

    const res = await GET({ url: 'http://localhost/api/funding-events?from=2025-01-01&to=2025-01-31&limit=50' } as any)
    expect(res.status).toBe(200)
    const body = (await (res as Response).json()) as any
    expect(body.limit).toBe(50)

    // Ensure canonical OR filter applied
    const mockedMod = require('@/lib/supabaseServer') as any
    const rec = mockedMod.__getRecorder()
    expect(rec).toBeTruthy()
    const expectedOr = [
      'and(funding_date.gte.2025-01-01,funding_date.lte.2025-01-31)',
      'and(funding_date.is.null,created_at.gte.2025-01-01,created_at.lte.2025-01-31)',
    ].join(',')
    expect(rec.orCalls).toContain(expectedOr)
  })

  it('applies open-ended from-only canonical window', async () => {
    const mocked = require('@/lib/supabaseServer') as any
    mocked.__setMockRows([])

    const res = await GET({ url: 'http://localhost/api/funding-events?from=2025-01-01' } as any)
    expect(res.status).toBe(200)

    const { __getRecorder } = mocked
    const rec = __getRecorder()
    expect(rec.orCalls).toContain('funding_date.gte.2025-01-01,and(funding_date.is.null,created_at.gte.2025-01-01)')
  })
})
