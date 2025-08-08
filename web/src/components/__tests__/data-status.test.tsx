import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import { DataStatus } from '../data-status'

const ORIGINAL_ENV = process.env

beforeEach(() => {
  jest.resetModules()
  process.env = { ...ORIGINAL_ENV }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('DataStatus', () => {
  test('renders nothing when Supabase envs are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    const { container } = render(<DataStatus />)
    expect(container.querySelector('[data-testid="data-status"]')).toBeNull()
  })

  test('shows count and last updated when Supabase envs exist', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon'

    const mockJson = { events: [], count: 42, lastUpdated: '2025-08-08T00:00:00Z', error: null }
    const originalFetch = (globalThis as any).fetch
    ;(globalThis as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockJson,
    } as Response)

    render(<DataStatus />)

    const status = await screen.findByTestId('data-status')
    expect(status).toBeInTheDocument()

    await waitFor(() => expect(screen.getByTestId('data-count')).toHaveTextContent('42'))
    await waitFor(() => expect(screen.getByTestId('data-last-updated')).toHaveTextContent('2025-08-08T00:00:00Z'))

    ;(globalThis as any).fetch = originalFetch
  })
})
