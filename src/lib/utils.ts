import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | null): string {
  if (!date) return ''
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'MMM d, yyyy')
}

export function formatRelativeDate(date: string): string {
  const d = new Date(date)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isThisWeek(d)) return format(d, 'EEEE')
  return format(d, 'MMM d')
}

export function isOverdue(date: string | null): boolean {
  if (!date) return false
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return isPast(d) && !isToday(new Date(date))
}

export function getContentPreview(content: Record<string, unknown> | null | undefined): string {
  if (!content) return ''
  try {
    const doc = content as { content?: Array<{ content?: Array<{ text?: string }> }> }
    if (!doc.content) return ''
    for (const block of doc.content) {
      if (block.content) {
        const text = block.content
          .filter((n) => n.text)
          .map((n) => n.text)
          .join('')
        if (text.trim()) return text.trim()
      }
    }
    return ''
  } catch {
    return ''
  }
}

export const PRIORITY_COLORS = {
  high: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', border: 'border-yellow-200' },
  low: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', border: 'border-green-200' },
} as const

export const TAG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#06b6d4', '#64748b', '#78716c',
]
