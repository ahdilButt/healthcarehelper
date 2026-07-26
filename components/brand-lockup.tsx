import Image from 'next/image'
import { cn } from '@/lib/utils'

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div
      className={cn('inline-flex items-center justify-center', className)}
    >
      <Image
        src="/healthcare-helper-logo.png"
        alt="HealthcareHelper"
        width={996}
        height={296}
        priority
        className="h-auto w-full max-w-[280px] rounded-2xl"
      />
    </div>
  )
}
