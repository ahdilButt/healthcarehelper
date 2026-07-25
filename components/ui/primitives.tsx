/**
 * Design-system primitives — SPEC-FINAL §8.
 *
 * Plain, token-correct versions so the works-lane is never blocked on the
 * design lane. When a v0-ui PR lands, its components replace these and the
 * screens keep the same props.
 */
import type { ReactNode } from 'react'

export function Card({
  children,
  className = '',
  as: Tag = 'div',
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'article' | 'section' | 'li'
}) {
  return (
    <Tag
      className={`rounded-[16px] border border-[var(--hh-hairline)] bg-[var(--hh-card)] p-4 ${className}`}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <h3 className="text-[17px] font-semibold leading-[1.3]">{children}</h3>
}

export function Meta({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[13px] leading-[1.4] text-[var(--hh-secondary)] ${className}`}>{children}</p>
  )
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[28px] font-semibold leading-[1.2]">{children}</h1>
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
  const base =
    'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-medium transition-opacity disabled:opacity-50 min-h-[44px]'
  const styles = {
    primary: 'bg-[var(--hh-accent)] text-white',
    quiet: 'bg-[var(--hh-accent-wash)] text-[var(--hh-text)]',
    ghost: 'border border-[var(--hh-hairline)] bg-[var(--hh-card)] text-[var(--hh-text)]',
  }[variant]
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  )
}

/** "from the cardiology letter · 12 May" — the citation made tappable. */
export function SourceChip({ label, onClick }: { label: string; onClick?: () => void }) {
  const cls =
    'inline-flex max-w-full items-center gap-1 rounded-[10px] bg-[var(--hh-accent-wash)] px-2 py-1 text-[13px] text-[var(--hh-text)]'
  const inner = <span className="truncate">{label}</span>
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  ) : (
    <span className={cls}>{inner}</span>
  )
}

/** "Unconfirmed — tap to check", never "low confidence" (SPEC-FINAL §8). */
export function UnconfirmedBadge({ onClick }: { onClick?: () => void }) {
  const cls =
    'inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[13px] font-medium text-[var(--hh-amber)] ring-1 ring-[var(--hh-amber)]/30'
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
    <div className="sticky top-0 z-10 -mx-4 bg-[var(--hh-bg)]/95 px-4 py-2 backdrop-blur">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--hh-secondary)]">
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

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] text-[var(--hh-secondary)]">
      <span
        aria-hidden
        className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--hh-hairline)] border-t-[var(--hh-accent)]"
      />
      {label}
    </span>
  )
}
