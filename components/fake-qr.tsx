import { cn } from '@/lib/utils'

// A deterministic decorative QR-style pattern for the demo (no scanning).
function pattern(size: number) {
  const cells: boolean[] = []
  for (let i = 0; i < size * size; i++) {
    const x = i % size
    const y = Math.floor(i / size)
    const finder =
      (x < 3 && y < 3) || (x > size - 4 && y < 3) || (x < 3 && y > size - 4)
    cells.push(finder || (x * 7 + y * 13 + ((x * y) % 5)) % 3 === 0)
  }
  return cells
}

export function FakeQr({ className, size = 21 }: { className?: string; size?: number }) {
  const cells = pattern(size)
  return (
    <div
      role="img"
      aria-label="QR code for this shared page"
      className={cn('grid aspect-square w-full gap-px bg-card p-2', className)}
      style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
    >
      {cells.map((on, i) => (
        <span key={i} className={on ? 'bg-foreground' : 'bg-transparent'} />
      ))}
    </div>
  )
}
