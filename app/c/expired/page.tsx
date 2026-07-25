export default function ExpiredCapsulePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col justify-center px-6 py-16">
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em]">HealthcareHelper</p>
      <h1 className="mt-3 text-[20px] font-semibold leading-snug">
        This link has expired or been turned off
      </h1>
      <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
        The person who shared it can send a new one. Nothing was deleted — the page is simply no longer
        open.
      </p>
    </div>
  )
}
