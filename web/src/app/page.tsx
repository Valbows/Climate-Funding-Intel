export const dynamic = 'force-dynamic'
export const revalidate = 0

import { Sidebar } from '../components/sidebar'
import { Topbar } from '../components/topbar'
import { getDashboardData } from '../lib/api'
import { DashboardClient } from '../components/dashboard-client'

export default async function Page() {
  const data = await getDashboardData()
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1">
        <Topbar />

        <DashboardClient data={data} />
      </main>
    </div>
  )
}
