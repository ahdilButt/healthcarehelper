import type * as React from 'react'
import { cn } from '@/lib/utils'

export function PageTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h1 className={cn('text-[28px] font-semibold tracking-[-0.01em] text-balance', className)}>
      {children}
    </h1>
  )
}

export function Card({
  children,
  className,
  tone = 'plain',
  as: As = 'div',
  ...rest
}: {
  children: React.ReactNode
  className?: string
  tone?: 'plain' | 'warn' | 'accent'
  as?: React.ElementType
} & React.HTMLAttributes<HTMLElement> &
  Record<string, unknown>) {
  return (
    <As
      className={cn(
        'rounded-lg border p-4',
        tone === 'plain' && 'border-border bg-card',
        tone === 'warn' && 'border-warn/25 bg-warn-wash',
        tone === 'accent' && 'border-primary/20 bg-accent',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  )
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('text-[17px] font-semibold leading-snug text-pretty', className)}>{children}</h2>
}

export function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[13px] text-muted-foreground', className)}>{children}</p>
}

export function SourceChip({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[13px] text-muted-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  )
}

export function StatusPill({
  children,
  tone = 'warn',
}: {
  children: React.ReactNode
  tone?: 'warn' | 'good' | 'alert'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium',
        tone === 'warn' && 'bg-warn-wash text-warn',
        tone === 'good' && 'bg-good-wash text-good',
        tone === 'alert' && 'bg-alert-wash text-alert',
      )}
    >
      {children}
    </span>
  )
}

export function PillButton({
  children,
  variant = 'primary',
  className,
  as: As = 'button',
  ...rest
}: {
  children: React.ReactNode
  variant?: 'primary' | 'quiet' | 'plain'
  className?: string
  as?: React.ElementType
} & React.ButtonHTMLAttributes<HTMLButtonElement> &
  Record<string, unknown>) {
  return (
    <As
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        variant === 'primary' && 'bg-primary text-primary-foreground active:bg-primary/90',
        variant === 'quiet' && 'bg-accent text-accent-foreground active:bg-accent/70',
        variant === 'plain' && 'border border-border bg-card text-foreground active:bg-muted',
        className,
      )}
      {...rest}
    >
      {children}
    </As>
  )
}

export function TypeIcon({
  children,
  tone = 'accent',
}: {
  children: React.ReactNode
  tone?: 'accent' | 'warn' | 'muted'
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        tone === 'accent' && 'bg-accent text-primary',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'muted' && 'bg-muted text-muted-foreground',
      )}
      aria-hidden="true"
    >
      {children}
    </span>
  )
}
