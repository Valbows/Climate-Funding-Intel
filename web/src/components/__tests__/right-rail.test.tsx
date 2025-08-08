import { render, screen } from '@testing-library/react'
import { TopSubSectors, FundingByRegion } from '../right-rail'

describe('Right rail widgets', () => {
  it('TopSubSectors renders list of items', () => {
    const items = [
      { name: 'EV Charging', pct: 20, dollars: '$8,500' },
      { name: 'Energy Storage', pct: 19, dollars: '$7,900' },
    ]
    render(<TopSubSectors items={items} />)
    expect(screen.getByText('Top Sub-Sectors')).toBeInTheDocument()
    expect(screen.getByText('EV Charging')).toBeInTheDocument()
    expect(screen.getByText('Energy Storage')).toBeInTheDocument()
  })

  it('FundingByRegion renders colored legend entries', () => {
    const items = [
      { name: 'U.S.A', pct: 31, dollars: '$5.79 bn', color: '#B0FE09' },
    ]
    render(<FundingByRegion items={items} />)
    expect(screen.getByText('Funding by Region')).toBeInTheDocument()
    expect(screen.getByText('U.S.A')).toBeInTheDocument()
    expect(screen.getByText('31% | $5.79 bn')).toBeInTheDocument()
  })
})
