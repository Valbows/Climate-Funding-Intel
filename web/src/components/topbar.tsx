import Image from 'next/image'
import { Bell, Settings, ChevronDown, Search } from 'lucide-react'

export function Topbar() {
  return (
    <div className="h-20 flex items-center justify-between border-b border-[color:var(--border)] px-6">
      <div className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-medium">Energy Grid Sector - Overview</h1>
        <p className="text-sm text-[color:var(--fg-muted)]">Overview {'>'} Industry Research</p>
      </div>

      <div className="flex items-center gap-3">
        <button className="h-10 w-10 grid place-items-center rounded bg-[#191919] border border-[color:var(--muted)]">
          <Bell size={18} />
        </button>
        <button className="h-10 w-10 grid place-items-center rounded bg-[#191919] border border-[color:var(--muted)]">
          <Settings size={18} />
        </button>
        <div className="flex items-center gap-3">
          <Image src="https://i.pravatar.cc/100?img=3" alt="avatar" width={40} height={40} className="rounded-full" />
          <div className="hidden md:block">
            <div className="text-sm">Dolly Mababe</div>
            <div className="text-xs text-[color:var(--fg-muted)]">dolly@deanscorp.com</div>
          </div>
          <ChevronDown size={18} />
        </div>
      </div>
    </div>
  )
}
