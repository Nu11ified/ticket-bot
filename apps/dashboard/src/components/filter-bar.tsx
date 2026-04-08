'use client'

import { Button } from '@/components/ui/button'
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select'
import { X } from 'lucide-react'

interface FilterOption {
	label: string
	value: string
}

interface FilterConfig {
	key: string
	label: string
	options: FilterOption[]
}

interface FilterBarProps {
	filters: FilterConfig[]
	values: Record<string, string | undefined>
	onChange: (key: string, value: string | undefined) => void
}

export function FilterBar({ filters, values, onChange }: FilterBarProps) {
	const activeFilters = Object.entries(values).filter(([, v]) => v !== undefined)

	return (
		<div className="flex flex-wrap items-center gap-2 mb-4">
			{filters.map((filter) => (
				<Select
					key={filter.key}
					value={values[filter.key] ?? null}
					onValueChange={(v) => onChange(filter.key, v || undefined)}
				>
					<SelectTrigger className="w-[160px] h-8 text-xs">
						<SelectValue>
							{(value: string | null) =>
								value
									? (filter.options.find((o) => o.value === value)?.label ?? value)
									: filter.label
							}
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{filter.options.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			))}
			{activeFilters.length > 0 && (
				<Button
					variant="ghost"
					size="sm"
					className="h-8 text-xs"
					onClick={() => {
						for (const [key] of activeFilters) {
							onChange(key, undefined)
						}
					}}
				>
					Clear filters
					<X className="h-3 w-3 ml-1" />
				</Button>
			)}
		</div>
	)
}
