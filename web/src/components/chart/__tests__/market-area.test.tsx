import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { MarketAreaChart } from '../market-area'
import type { CashflowPoint } from '@/lib/api'

describe('MarketAreaChart', () => {
  it('renders title, subtitle, timeframe and legend values', () => {
    const data: CashflowPoint[] = [
      { month: 'Jan', revenue: 1000, expense: 500 },
      { month: 'Feb', revenue: 1200, expense: 700 },
    ]

    render(
      <div style={{ width: 800, height: 400 }}>
        <MarketAreaChart data={data} />
      </div>
    )

    expect(screen.getByText('Cashflow Analysis')).toBeInTheDocument()
    expect(
      screen.getByText('Visual representation of financial performance')
    ).toBeInTheDocument()
    expect(screen.getByText('Last 6 Months')).toBeInTheDocument()

    // Bottom legend summary (static values in component)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$11,520')).toBeInTheDocument()
    expect(screen.getByText('Expenses')).toBeInTheDocument()
    expect(screen.getByText('$1,100')).toBeInTheDocument()
  })
})
