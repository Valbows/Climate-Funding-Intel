import '@testing-library/jest-dom'
// Minimal ResizeObserver mock for Recharts' ResponsiveContainer in JSDOM
if (typeof window !== 'undefined' && !(window as any).ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  ;(window as any).ResizeObserver = ResizeObserverMock as any
}

// Silence Recharts ResponsiveContainer zero width/height warnings by ensuring a fixed-size container in tests
import React from 'react'
jest.mock('recharts', () => {
  const Original = jest.requireActual('recharts')
  const MockResponsiveContainer = (props: any) => {
    const width = typeof props.width === 'number' ? props.width : 800
    const height = typeof props.height === 'number' ? props.height : 400
    return React.createElement(
      'div',
      { style: { width, height } },
      typeof props.children === 'function' ? props.children({ width, height }) : props.children
    )
  }
  return {
    ...Original,
    ResponsiveContainer: MockResponsiveContainer,
  }
})
