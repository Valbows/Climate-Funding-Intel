import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'

type Tint = 'green' | 'red'

export function MetricCard({
  label,
  value,
  subtitle,
  delta,
  deltaTint = 'green',
}: {
  label: string
  value: string
  subtitle: string
  delta: string | number
  deltaTint?: Tint
}) {
  const isNumber = typeof delta === 'number'
  const computedTint: Tint = isNumber ? (delta as number) >= 0 ? 'green' : 'red' : deltaTint
  const tintClass = computedTint === 'green' ? 'bg-[#163515] text-[#05C702]' : 'bg-[#381515] text-[#FF6B6B]'

  const deltaLabel = (() => {
    if (isNumber) {
      const n = delta as number
      const sign = n >= 0 ? '+' : '−'
      const abs = Math.abs(n)
      return `${sign}${abs.toFixed(1)}%`
    }
    // legacy string behavior (assume string excludes leading sign)
    return `+${delta}`
  })()

  return (
    <Card className="relative">
      <CardContent className="pt-20">
        <div className="flex flex-col gap-1 ml-6">
          <div className="text-sm text-white/90">{label}</div>
          <div className="text-4xl md:text-2xl font-extrabold leading-tight tracking-tight truncate">{value}</div>
          <div className="text-sm text-[color:var(--fg-muted)]">{subtitle}</div>
        </div>
      </CardContent>
      <div className="absolute left-6 top-6">
        <Badge
          className={`px-3 py-2 ${tintClass}`}
          title="Change vs previous 30 days"
          aria-label="Change versus previous 30 days"
        >
          {deltaLabel}
        </Badge>
      </div>
    </Card>
  )
}
