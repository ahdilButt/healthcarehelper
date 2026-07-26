import { cn } from '@/lib/utils'

/**
 * The name, as text rather than an image.
 *
 * It used to be a PNG with the wordmark drawn into it, which meant renaming
 * the product needed a designer. Set in type it scales, stays legible to a
 * screen reader, inherits the palette, and changes in one place — the constant
 * below.
 *
 * The mark is the shoebox from icon.svg: the thing the letters come out of.
 */
export const PRODUCT_NAME = 'Aftercare'

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 rounded-2xl bg-card px-5 py-3 shadow-sm',
        className
      )}
    >
      <span
        aria-hidden
        className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary"
      >
        <svg width="26" height="26" viewBox="0 0 192 192" fill="none">
          <path
            d="M40 78h112v66a8 8 0 0 1-8 8H48a8 8 0 0 1-8-8V78Z"
            stroke="white"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <path
            d="M28 60 50 40h92l22 20v18H28V60Z"
            stroke="white"
            strokeWidth="10"
            strokeLinejoin="round"
          />
          <path d="M96 100v30M81 115h30" stroke="white" strokeWidth="10" strokeLinecap="round" />
        </svg>
      </span>

      <span className="text-[26px] leading-none font-semibold tracking-[-0.02em]">
        After<span className="text-primary">care</span>
      </span>
    </div>
  )
}
