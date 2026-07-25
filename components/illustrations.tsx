export function ShoeboxIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={className} aria-hidden="true">
      <path
        d="M30 62h140v58a4 4 0 0 1-4 4H34a4 4 0 0 1-4-4V62Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M22 48h156v14H22z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M84 62h32v12H84z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path
        d="M62 48V22a3 3 0 0 1 3-3h48l14 13v16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M74 30h24M74 39h30" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function CupIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 140" fill="none" className={className} aria-hidden="true">
      <path
        d="M46 52h94v44a26 26 0 0 1-26 26H72a26 26 0 0 1-26-26V52Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M140 62h12a14 14 0 0 1 0 28h-12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M76 38c0-8 8-8 8-16M100 38c0-8 8-8 8-16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function BodyOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 4 160 236" fill="none" className={className} aria-hidden="true">
      <circle cx="80" cy="34" r="20" stroke="currentColor" strokeWidth="2" />
      <path d="M80 54v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M80 64c-14 0-26 6-31 16l-14 30c-2 5 0 9 4 10 4 1 7-1 9-5l8-16v40l-4 60c-1 6 2 10 7 10s8-3 9-9l9-46 9 46c1 6 4 9 9 9s8-4 7-10l-4-60v-40l8 16c2 4 5 6 9 5 4-1 6-5 4-10l-14-30c-5-10-17-16-31-16Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}
