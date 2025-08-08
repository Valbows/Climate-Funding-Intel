import type { SubSector, RegionFunding } from '../lib/api'

export function TopSubSectors({ items, onSelect }: { items: SubSector[]; onSelect?: (name: string) => void }) {
  return (
    <div className="space-y-4" data-testid="subsectors-section">
      <div>
        <div className="text-xl font-medium">Top Sub-Sectors</div>
        <div className="text-sm text-[color:var(--fg-muted)]">Energy Grid with highest revenue</div>
      </div>
      <div className="card p-6 space-y-6">
        {items.map((it) => (
          <button
            key={it.name}
            type="button"
            className="grid grid-cols-[1fr_auto] gap-3 items-center w-full text-left cursor-pointer hover:bg-white/5 rounded p-2 -mx-2 transition"
            data-testid="subsector-item"
            aria-label={`Filter by ${it.name}`}
            onClick={() => onSelect?.(it.name)}
          >
            <div>
              <div className="flex items-center justify-between text-sm">
                <span>{it.name}</span>
                <span className="text-[color:var(--fg-muted)]">{it.pct}% | {it.dollars}</span>
              </div>
              <div className="progress-track mt-2">
                <div className="progress-fill" style={{ width: `${Math.max(10, it.pct * 2)}px` }} />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function FundingByRegion({ items, onSelect }: { items: RegionFunding[]; onSelect?: (name: string) => void }) {
  return (
    <div className="space-y-4" data-testid="regions-section">
      <div>
        <div className="text-xl font-medium">Funding by Region</div>
        <div className="text-sm text-[color:var(--fg-muted)]">Countries with highest revenue</div>
      </div>
      <div className="card p-6">
        <div className="space-y-4">
          {items.map((it) => (
            <button
              key={it.name}
              type="button"
              className="flex items-center gap-3 text-sm w-full text-left cursor-pointer hover:bg-white/5 rounded p-2 -mx-2 transition"
              data-testid="region-item"
              aria-label={`Filter by ${it.name}`}
              onClick={() => onSelect?.(it.name)}
            >
              <span className="h-2 w-2 rounded-sm" style={{ background: it.color }} />
              <span className="w-24">{it.name}</span>
              <div className="ml-auto text-[color:var(--fg-muted)]">{it.pct}% | {it.dollars}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
