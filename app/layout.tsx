import type { Metadata, Viewport } from 'next'
import './globals.css'

/** System fonts, light mode only (SPEC-FINAL §8) — no webfont round-trip. */
export const metadata: Metadata = {
  title: 'Aftercare',
  description:
    'A warm family tool for complex care. Photograph the letters and a shareable, understandable record assembles itself.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Aftercare', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf6f1',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  )
}
