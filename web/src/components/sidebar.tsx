import Link from 'next/link'
import { cn } from '../lib/utils'
import { Bell, Settings, LayoutDashboard, Users, Wrench } from 'lucide-react'

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '#' },
  { label: 'Financial Projection', icon: Wrench, href: '#' },
  { label: 'Services', icon: Wrench, href: '#' },
  { label: 'Users', icon: Users, href: '#' },
  { label: 'Settings', icon: Settings, href: '#' },
]

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:flex-col w-72 min-h-screen border-r border-[color:var(--border)] bg-black/40">
      <div className="h-20 flex items-center px-6 border-b border-[color:var(--border)]">
        <div className="h-8 w-8 rounded-full bg-white/10 mr-3" />
        <span className="text-lg font-semibold">NRG Data</span>
      </div>

      <div className="px-6 py-8 space-y-6">
        <div>
          <p className="text-2xl font-medium leading-6">Welcome Back,</p>
          <p className="text-2xl font-medium leading-6">Dolly Mababe</p>
          <p className="text-sm text-[color:var(--fg-muted)] mt-2">Overview of deanscorp finances</p>
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => (
            <Link key={item.label} href={item.href} className={cn('flex items-center gap-3 px-4 py-3 rounded bg-[#191919] text-white') }>
              <item.icon size={18} className="opacity-80" />
              <span className="text-sm">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-6 flex items-center gap-3 text-sm text-[color:var(--fg-muted)]">
        <Bell size={18} />
        <span>Notifications</span>
      </div>
    </aside>
  )
}
