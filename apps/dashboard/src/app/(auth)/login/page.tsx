import { LogIn } from 'lucide-react'

export default function LoginPage() {
	const apiBase = process.env.API_URL || 'http://localhost:3001'

	return (
		<div className="glass-panel p-12 text-center max-w-md">
			<h1 className="text-3xl font-semibold tracking-tight mb-3">TicketBot</h1>
			<p className="text-glass-300 text-sm mb-6">Sign in to manage your Discord servers.</p>
			<a
				href={`${apiBase}/api/auth/sign-in/social?provider=discord&callbackURL=/guilds`}
				className="glass-button inline-flex items-center gap-2"
			>
				<LogIn className="h-4 w-4" />
				Sign in with Discord
			</a>
		</div>
	)
}
