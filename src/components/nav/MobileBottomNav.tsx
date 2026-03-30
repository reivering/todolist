'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, CheckSquare, Layers, BookMarked } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/notes', icon: FileText, label: 'Notes' },
  { href: '/todos', icon: CheckSquare, label: 'Todos' },
  { href: '/flashcards', icon: Layers, label: 'Cards' },
  { href: '/briefings', icon: BookMarked, label: 'Briefs' },
]

export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 safe-bottom">
      <div className="flex items-center justify-around h-14">
        {navItems.map(({ href, icon: Icon, label }) => {
          const active = pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors',
                active ? 'text-violet-400' : 'text-slate-500 active:text-slate-300'
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className={cn('text-[10px]', active && 'font-semibold')}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
