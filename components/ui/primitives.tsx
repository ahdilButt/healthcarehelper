/**
 * Design-system primitives — SPEC-FINAL §8, wearing the design lane's clothes.
 *
 * The markup and classes here come from v0's `components/ui-bits.tsx`; the
 * props are the ones this app already calls with, so adopting their look did
 * not mean touching a single screen. Both lanes read §8 independently and
 * produced identical hex values, so the semantic class names (`bg-card`,
 * `text-muted-foreground`) resolve to the same palette either way — see the
 * alias block in app/globals.css.
 */
import type { ReactNode, ElementType } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  children,
  className = '',
  tone = 'plain',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  tone?: 'plain' | 'warn' | 'accent'
  as?: ElementType
}) {
  return (
    <Tag
      className={cn(
        'rounded-lg border p-4',
        tone === 'plain' && 'border-border bg-card',
        tone === 'warn' && 'border-warn/25 bg-warn-wash',
        tone === 'accent' && 'border-primary/20 bg-accent',
        className
      )}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <h3 className="text-[17px] font-semibold leading-snug text-pretty">{children}</h3>
}

export function Meta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('text-[13px] leading-[1.4] text-muted-foreground', className)}>{children}</p>
  )
}

export function PageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.01em] text-balance">
      {children}
    </h1>
  )
}

type ButtonProps = {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  variant?: 'primary' | 'quiet' | 'ghost'
  disabled?: boolean
  className?: string
}

export function Button({
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  disabled,
  className = '',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition-colors disabled:opacity-50',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        variant === 'primary' && 'bg-primary text-primary-foreground active:bg-primary/90',
        variant === 'quiet' && 'bg-accent text-accent-foreground active:bg-accent/70',
        variant === 'ghost' && 'border border-border bg-card text-foreground active:bg-muted',
        className
      )}
    >
      {children}
    </button>
  )
}

/** "from the cardiology letter · 12 May" — the citation made tappable. */
export function SourceChip({ label, onClick }: { label: string; onClick?: () => void }) {
  const cls =
    'inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[13px] text-muted-foreground'
  const inner = (
    <>
      <span className="size-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden />
      <span className="truncate">{label}</span>
    </>
  )
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

export function StatusPill({
  children,
  tone = 'warn',
}: {
  children: ReactNode
  tone?: 'warn' | 'good' | 'alert'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-medium',
        tone === 'warn' && 'bg-warn-wash text-warn',
        tone === 'good' && 'bg-good-wash text-good',
        tone === 'alert' && 'bg-alert-wash text-alert'
      )}
    >
      {children}
    </span>
  )
}

/** The circular icon chip at the head of a card. */
export function TypeIcon({
  children,
  tone = 'accent',
}: {
  children: ReactNode
  tone?: 'accent' | 'warn' | 'muted'
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full',
        tone === 'accent' && 'bg-accent text-primary',
        tone === 'warn' && 'bg-warn/15 text-warn',
        tone === 'muted' && 'bg-muted text-muted-foreground'
      )}
      aria-hidden
    >
      {children}
    </span>
  )
}

/** "Unconfirmed — tap to check", never "low confidence" (SPEC-FINAL §8). */
export function UnconfirmedBadge({ onClick }: { onClick?: () => void }) {
  const cls =
    'inline-flex items-center rounded-full bg-warn-wash px-2.5 py-1 text-[13px] font-medium text-warn'
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      Unconfirmed — tap to check
    </button>
  ) : (
    <span className={cls}>Unconfirmed</span>
  )
}

export function MonthHeader({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-10 -mx-4 bg-background/95 px-4 py-2 backdrop-blur">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </h2>
    </div>
  )
}

export function EmptyState({
  title,
  body,
  action,
  illustration,
}: {
  title: string
  body: string
  action?: ReactNode
  illustration?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      {illustration}
      <CardHeader>{title}</CardHeader>
      <Meta className="max-w-[28ch]">{body}</Meta>
      {action}
    </div>
  )
}

/** Someone corrected this by hand. Quiet — a mark, never a diff view. */
export function EditedMark({ className = '' }: { className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 text-[13px] text-muted-foreground', className)}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
      edited
    </span>
  )
}

/** One line of a detail sheet: quiet label, human value, optional action. */
export function FieldRow({
  label,
  value,
  note,
  action,
}: {
  label: string
  value: ReactNode
  note?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-[1.4] text-muted-foreground">{label}</p>
        <div className="mt-[2px] text-[15px] leading-[1.45] break-words">{value}</div>
        {note}
      </div>
      {action}
    </div>
  )
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
      <span
        aria-hidden
        className="size-3 animate-spin rounded-full border-2 border-border border-t-primary"
      />
      {label}
    </span>
  )
}
