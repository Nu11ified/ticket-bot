'use client'

import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Sidebar } from './sidebar'

export function MobileNav({ guildId }: { guildId: number }) {
	const [open, setOpen] = useState(false)

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger render={<Button variant="ghost" size="sm" className="lg:hidden" />}>
				<Menu className="h-5 w-5" />
			</SheetTrigger>
			<SheetContent side="left" className="p-0 w-64">
				<Sidebar guildId={guildId} />
			</SheetContent>
		</Sheet>
	)
}
