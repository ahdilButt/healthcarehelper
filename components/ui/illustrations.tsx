/** Minimal single-weight line SVGs in the accent (SPEC-FINAL §8, decision B7). */

const stroke = 'var(--hh-accent)'

export function ShoeboxIllustration({ size = 96 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.72} viewBox="0 0 120 86" fill="none" aria-hidden>
      <path
        d="M10 34h100v42a4 4 0 0 1-4 4H14a4 4 0 0 1-4-4V34Z"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M4 22 22 8h76l18 14v12H4V22Z" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d="M48 34v10h24V34" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <path d="M60 58v14M53 65h14" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function EnvelopeIllustration({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.7} viewBox="0 0 100 70" fill="none" aria-hidden>
      <rect x="4" y="8" width="92" height="54" rx="4" stroke={stroke} strokeWidth="2" />
      <path d="m4 13 46 30 46-30" stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * The body outline for patch site rotation. `last` is marked, `next` pulses.
 * Sites match DATASET-BIBLE §4: left/right hip, left/right upper arm.
 */
const SITE_POINTS: Record<string, { cx: number; cy: number }> = {
  'left hip': { cx: 40, cy: 96 },
  'right hip': { cx: 68, cy: 96 },
  'left upper arm': { cx: 24, cy: 58 },
  'right upper arm': { cx: 84, cy: 58 },
}

export function BodyMap({
  last,
  next,
  size = 180,
}: {
  last?: string | null
  next?: string | null
  size?: number
}) {
  return (
    <svg
      width={size}
      height={size * 1.35}
      viewBox="0 0 108 146"
      fill="none"
      role="img"
      aria-label={`Patch sites. Last used: ${last ?? 'none yet'}. Next: ${next ?? 'any'}.`}
    >
      {/* head, torso, arms, legs — one weight, no fill */}
      <circle cx="54" cy="15" r="10" stroke={stroke} strokeWidth="2" />
      <path
        d="M54 26c-12 0-20 6-21 16l-3 26h9l2 44h26l2-44h9l-3-26c-1-10-9-16-21-16Z"
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M33 44 22 72M75 44l11 28" stroke={stroke} strokeWidth="2" strokeLinecap="round" />
      <path d="M45 112v26M63 112v26" stroke={stroke} strokeWidth="2" strokeLinecap="round" />

      {Object.entries(SITE_POINTS).map(([name, { cx, cy }]) => {
        const isLast = last === name
        const isNext = next === name
        return (
          <g key={name}>
            {isNext && (
              <circle cx={cx} cy={cy} r="9" fill={stroke} opacity="0.25">
                <animate attributeName="r" values="7;11;7" dur="1.8s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.3;0.05;0.3" dur="1.8s" repeatCount="indefinite" />
              </circle>
            )}
            <circle
              cx={cx}
              cy={cy}
              r="5"
              fill={isNext ? stroke : isLast ? 'var(--hh-secondary)' : 'none'}
              stroke={isLast || isNext ? 'none' : stroke}
              strokeWidth="1.5"
              opacity={isLast ? 0.55 : 1}
            />
          </g>
        )
      })}
    </svg>
  )
}

export const PATCH_SITES = Object.keys(SITE_POINTS)
