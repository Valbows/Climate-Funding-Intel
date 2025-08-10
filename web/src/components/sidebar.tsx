"use client"
import React from 'react'

export function Sidebar() {
  const [investor, setInvestor] = React.useState('')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')

  const dispatch = (detail: { investor?: string; from?: string; to?: string }) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('companies-filters-change', { detail }))
    }
  }

  React.useEffect(() => {
    dispatch({ investor, from, to })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investor, from, to])

  const clear = () => {
    setInvestor('')
    setFrom('')
    setTo('')
    dispatch({ investor: '', from: '', to: '' })
  }

  return (
    <aside className="hidden md:flex md:flex-col w-72 min-h-screen border-r border-[color:var(--border)] bg-black/40">
      <div className="h-20 flex items-center px-6 border-b border-[color:var(--border)]">
        <span className="text-lg font-semibold">CLIMATE TRACKER INTEL</span>
      </div>

      <div className="px-6 py-8 space-y-6">
        <div className="space-y-3">
          <div className="text-xl font-medium">Companies Filters</div>
          <label className="block text-sm text-[color:var(--fg-muted)]">Lead Investor</label>
          <input
            type="text"
            value={investor}
            onChange={(e) => setInvestor(e.target.value)}
            placeholder="Search by investor name..."
            className="w-full rounded px-3 py-2 bg-[#191919] border border-[color:var(--border)] outline-none text-sm placeholder:text-[color:var(--fg-muted)]"
          />

          <label className="block text-sm text-[color:var(--fg-muted)] mt-4">Funding Date Range</label>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded px-3 py-2 bg-[#191919] border border-[color:var(--border)] outline-none text-sm"
            />
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded px-3 py-2 bg-[#191919] border border-[color:var(--border)] outline-none text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={clear}
              className="px-3 py-2 text-xs border border-[color:var(--border)] rounded hover:bg-white/5"
            >
              Clear filters
            </button>
          </div>
        </div>
      </div>

    </aside>
  )
}
