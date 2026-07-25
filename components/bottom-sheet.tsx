'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  className?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/25"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'animate-in slide-in-from-bottom-4 relative flex max-h-[88vh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[24px] bg-card duration-200',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 pb-3 pt-4">
          <h2 className="text-[17px] font-semibold text-pretty">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="no-scrollbar overflow-y-auto px-5 pb-8 pt-4">{children}</div>
      </div>
    </div>
  )
}
