import React from 'react'
import '@testing-library/jest-dom'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DashboardClient } from '../../components/dashboard-client'
import type { DashboardData } from '../../lib/api'

const SAMPLE: DashboardData = {
  metrics: {
    totalFunding: '$1.23 B',
    highestSector: 'Solar',
    mostActiveInvestor: 'Alpha Fund',
  },
  cashflow: [
    { month: 'January', revenue: 100, expense: 50 },
    { month: 'February', revenue: 150, expense: 60 },
  ],
  subSectors: [
    { name: 'Solar', pct: 40, dollars: '$400' },
    { name: 'Wind', pct: 30, dollars: '$300' },
  ],
  regions: [
    { name: 'Canada', pct: 55, dollars: '$550', color: '#00AAFF' },
    { name: 'Kenya', pct: 45, dollars: '$450', color: '#FFAA00' },
  ],
}

describe('DashboardClient search filtering', () => {
  it('filters sub-sectors by query', async () => {
    render(<DashboardClient data={SAMPLE} />)

    const input = screen.getByPlaceholderText('Search sectors or regions') as HTMLInputElement
    expect(input.value).toBe('')

    // Initially, both items visible
    const subSection = screen.getByTestId('subsectors-section')
    expect(within(subSection).getByText('Solar')).toBeInTheDocument()
    expect(within(subSection).getByText('Wind')).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'so' } })

    expect(within(subSection).getByText('Solar')).toBeInTheDocument()
    expect(within(subSection).queryByText('Wind')).toBeNull()
  })

  it('filters regions by query', async () => {
    render(<DashboardClient data={SAMPLE} />)

    const input = screen.getByPlaceholderText('Search sectors or regions') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'can' } })

    const regionSection = screen.getByTestId('regions-section')
    expect(within(regionSection).getByText('Canada')).toBeInTheDocument()
    expect(within(regionSection).queryByText('Kenya')).toBeNull()
  })

  it('updates item counts with filtering', () => {
    render(<DashboardClient data={SAMPLE} />)

    const input = screen.getByPlaceholderText('Search sectors or regions') as HTMLInputElement

    const subSection = screen.getByTestId('subsectors-section')
    const regionSection = screen.getByTestId('regions-section')

    // Initial counts
    expect(within(subSection).getAllByTestId('subsector-item')).toHaveLength(2)
    expect(within(regionSection).getAllByTestId('region-item')).toHaveLength(2)

    // Filter to one each
    fireEvent.change(input, { target: { value: 'so' } })
    expect(within(subSection).getAllByTestId('subsector-item')).toHaveLength(1)

    fireEvent.change(input, { target: { value: 'can' } })
    expect(within(regionSection).getAllByTestId('region-item')).toHaveLength(1)

    // No matches
    fireEvent.change(input, { target: { value: 'zz' } })
    expect(within(subSection).queryAllByTestId('subsector-item')).toHaveLength(0)
    expect(within(regionSection).queryAllByTestId('region-item')).toHaveLength(0)
  })

  it('matches case-insensitively and resets on clear', () => {
    render(<DashboardClient data={SAMPLE} />)

    const input = screen.getByPlaceholderText('Search sectors or regions') as HTMLInputElement
    const subSection = screen.getByTestId('subsectors-section')

    fireEvent.change(input, { target: { value: 'SOL' } })
    expect(within(subSection).getAllByTestId('subsector-item')).toHaveLength(1)
    expect(within(subSection).getByText('Solar')).toBeInTheDocument()

    // Clear
    fireEvent.change(input, { target: { value: '' } })
    expect(within(subSection).getAllByTestId('subsector-item')).toHaveLength(2)
  })
})
