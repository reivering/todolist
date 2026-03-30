'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { X, AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open, title, description, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel
}: ConfirmModalProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
      if (e.key === 'Enter') onConfirm()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onConfirm, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900 rounded-2xl shadow-xl border border-slate-700 w-full max-w-sm mx-4 p-6">
        <button onClick={onCancel} className="absolute top-4 right-4 p-1 hover:bg-slate-800 rounded-lg text-slate-500">
          <X size={16} />
        </button>
        <div className="flex items-start gap-3 mb-4">
          <div className={cn('p-2 rounded-lg flex-shrink-0', danger ? 'bg-red-50' : 'bg-slate-900/50')}>
            <AlertTriangle size={18} className={danger ? 'text-red-500' : 'text-slate-400'} />
          </div>
          <div>
            <h3 className="font-semibold text-slate-100 text-sm">{title}</h3>
            {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-900/50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={cn(
              'px-4 py-2 text-sm rounded-lg font-medium text-white',
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-violet-600 hover:bg-violet-700'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
