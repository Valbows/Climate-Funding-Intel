import { render, screen } from '@testing-library/react'
import { MetricCard } from '../metric-card'

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(
      <MetricCard label="Total Funding" value="$1.23 B" subtitle="Updated now" delta="3.4%" />
    )
    expect(screen.getByText('Total Funding')).toBeInTheDocument()
    expect(screen.getByText('$1.23 B')).toBeInTheDocument()
    expect(screen.getByText('Updated now')).toBeInTheDocument()
    expect(screen.getByText(/\+?\s*3\.4%/)).toBeInTheDocument()
  })
})
