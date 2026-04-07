'use client'

import { Skeleton } from '@/components/ui/skeleton'
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table'

export interface Column<T> {
	key: string
	header: string
	cell: (row: T) => React.ReactNode
	className?: string
}

interface DataTableProps<T> {
	columns: Column<T>[]
	data: T[]
	isLoading?: boolean
	onRowClick?: (row: T) => void
	emptyState?: React.ReactNode
}

export function DataTable<T>({
	columns,
	data,
	isLoading,
	onRowClick,
	emptyState,
}: DataTableProps<T>) {
	if (isLoading) {
		return (
			<Table>
				<TableHeader>
					<TableRow>
						{columns.map((col) => (
							<TableHead key={col.key} className={col.className}>
								{col.header}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{Array.from({ length: 5 }).map((_, i) => (
						<TableRow key={`skeleton-${i.toString()}`}>
							{columns.map((col) => (
								<TableCell key={col.key}>
									<Skeleton className="h-4 w-full" />
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
		)
	}

	if (data.length === 0 && emptyState) {
		return <>{emptyState}</>
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					{columns.map((col) => (
						<TableHead key={col.key} className={col.className}>
							{col.header}
						</TableHead>
					))}
				</TableRow>
			</TableHeader>
			<TableBody>
				{data.map((row, i) => (
					<TableRow
						key={`row-${i.toString()}`}
						className={onRowClick ? 'cursor-pointer hover:bg-glass-50' : undefined}
						onClick={() => onRowClick?.(row)}
					>
						{columns.map((col) => (
							<TableCell key={col.key} className={col.className}>
								{col.cell(row)}
							</TableCell>
						))}
					</TableRow>
				))}
			</TableBody>
		</Table>
	)
}
