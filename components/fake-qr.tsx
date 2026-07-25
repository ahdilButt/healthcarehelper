import { cn } from '@/lib/utils'

// A deterministic decorative QR-style pattern for the demo (not a scannable code).
// Rendered as SVG rects so it always paints, whatever the container size.
const MODULES = 25

function seedFrom(value: string) {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash)
}

function isFinder(x: number, y: number) {
  const inBlock = (bx: number, by: number) => x >= bx && x < bx + 7 && y >= by && y < by + 7
  const blocks = [
    [0, 0],
    [MODULES - 7, 0],
    [0, MODULES - 7],
  ]
  return blocks.some(([bx, by]) => inBlock(bx, by))
}

function finderOn(x: number, y: number) {
  const bx = x < 7 ? 0 : MODULES - 7
  const by = y < 7 ? 0 : MODULES - 7
  const lx = x - bx
  const ly = y - by
  const ring = lx === 0 || lx === 6 || ly === 0 || ly === 6
  const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4
  return ring || core
}

export function FakeQr({ value = 'demo', className }: { value?: string; className?: string }) {
  const seed = seedFrom(value)
  const cells: { x: number; y: number }[] = []

  for (let y = 0; y < MODULES; y++) {
    for (let x = 0; x < MODULES; x++) {
      if (isFinder(x, y)) {
        if (finderOn(x, y)) cells.push({ x, y })
        continue
      }
      const noise = Math.imul(seed ^ (x * 73856093), y * 19349663 + 1) >>> 8
      if (noise % 100 < 48) cells.push({ x, y })
    }
  }

  return (
    <svg
      viewBox={`0 0 ${MODULES} ${MODULES}`}
      role="img"
      aria-label="QR code for this shared page"
      shapeRendering="crispEdges"
      className={cn('block aspect-square w-full', className)}
    >
      <rect width={MODULES} height={MODULES} fill="var(--card)" />
      {cells.map((cell) => (
        <rect
          key={`${cell.x}-${cell.y}`}
          x={cell.x}
          y={cell.y}
          width={1}
          height={1}
          fill="var(--foreground)"
        />
      ))}
    </svg>
  )
}
