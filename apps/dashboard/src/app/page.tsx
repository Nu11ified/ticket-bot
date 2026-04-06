export default function Home() {
	return (
		<main className="flex min-h-screen items-center justify-center p-8">
			<div className="glass-panel p-12 text-center max-w-md">
				<h1 className="text-3xl font-semibold tracking-tight mb-3">TicketBot</h1>
				<p className="text-glass-300 text-sm mb-6">Discord ticket management, reimagined.</p>
				<button type="button" className="glass-button">
					Sign in with Discord
				</button>
			</div>
		</main>
	)
}
