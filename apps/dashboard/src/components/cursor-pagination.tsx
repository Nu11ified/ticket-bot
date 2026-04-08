import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CursorPaginationProps {
	hasMore: boolean
	hasPrev: boolean
	onNext: () => void
	onPrev: () => void
}

export function CursorPagination({ hasMore, hasPrev, onNext, onPrev }: CursorPaginationProps) {
	return (
		<div className="flex items-center justify-end gap-2 mt-4">
			<Button variant="outline" size="sm" disabled={!hasPrev} onClick={onPrev}>
				<ChevronLeft className="h-4 w-4 mr-1" />
				Previous
			</Button>
			<Button variant="outline" size="sm" disabled={!hasMore} onClick={onNext}>
				Next
				<ChevronRight className="h-4 w-4 ml-1" />
			</Button>
		</div>
	)
}
