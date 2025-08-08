import './globals.css'
import { Urbanist } from 'next/font/google'
import React from 'react'

const urbanist = Urbanist({ subsets: ['latin'] })

export const metadata = {
  title: 'NRG Data Dashboard',
  description: 'Energy Grid Sector - Overview',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={urbanist.className} suppressHydrationWarning>
      <body className="bg-[#111111] text-white antialiased">{children}</body>
    </html>
  )
}
