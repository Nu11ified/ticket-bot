import { cn } from '@/lib/utils'
import { QueryProvider } from '@/providers/query-provider'
import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
	title: 'TicketBot Dashboard',
	description: 'Manage your Discord ticket bot',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={cn('dark', geist.variable)}>
			<body className="min-h-screen bg-surface antialiased">
				<QueryProvider>
					{children}
					<Toaster theme="dark" richColors />
				</QueryProvider>
			</body>
		</html>
	)
}
