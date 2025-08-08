'use client'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CashflowPoint } from '../../lib/api'

export function MarketAreaChart({ data }: { data: CashflowPoint[] }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xl font-medium">Cashflow Analysis</div>
          <div className="text-sm text-[color:var(--fg-muted)]">Visual representation of financial performance</div>
        </div>
        <div className="px-3 py-2 rounded bg-[#191919] text-sm">Last 6 Months</div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0177FB" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0177FB" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FE6B2C" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#FE6B2C" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#7B7B7B" strokeOpacity={0.25} vertical={false} />
            <XAxis dataKey="month" tick={{ fill: '#fff', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#fff', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#1b1b1b', border: '1px solid #272727' }} />
            <Area type="monotone" dataKey="expense" stroke="#0171EE" strokeWidth={2} fill="url(#rev)" />
            <Area type="monotone" dataKey="revenue" stroke="#FE6B2C" strokeWidth={2} fill="url(#exp)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-[color:var(--fg-muted)]">
        <div className="flex items-center gap-2"><span className="h-2 w-2 bg-[#0177FB]"></span> Revenue <span className="ml-auto font-semibold text-white">$11,520</span></div>
        <div className="flex items-center gap-2"><span className="h-2 w-2 bg-[#FE6B2C]"></span> Expenses <span className="ml-auto font-semibold text-white">$1,100</span></div>
      </div>
    </div>
  )
}
