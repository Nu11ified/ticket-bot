import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TicketBot Dashboard',
  description: 'Manage your Discord ticket bot',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-surface antialiased">{children}</body>
    </html>
  )
}
