import { Badge } from './ui/badge'
import { Card, CardContent } from './ui/card'

export function MetricCard({ label, value, subtitle, delta, deltaTint = 'green' }: { label: string; value: string; subtitle: string; delta: string; deltaTint?: 'green' | 'red' }) {
  const tint = deltaTint === 'green' ? 'bg-[#163515] text-[#05C702]' : 'bg-[#381515] text-[#FF6B6B]'
  return (
    <Card className="relative">
      <CardContent className="pt-20">
        <div className="flex flex-col gap-1 ml-6">
          <div className="text-sm text-white/90">{label}</div>
          <div className="text-4xl font-extrabold">{value}</div>
          <div className="text-sm text-[color:var(--fg-muted)]">{subtitle}</div>
        </div>
      </CardContent>
      <div className="absolute left-6 top-6">
        <Badge className={`px-3 py-2 ${tint}`}>+{delta}</Badge>
      </div>
    </Card>
  )
}
