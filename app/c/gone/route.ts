/**
 * The dead-link page, as a route handler rather than a page.
 *
 * API-CONTRACTS.md requires 410 for an expired or revoked capsule, and a
 * rendered page in the App Router cannot choose its own status code — only
 * 404/401/403 are reachable from a page. So the capsule page redirects here and
 * this returns the real status with the real words. Self-contained markup: the
 * clinical style is deliberately not the app's, and a dead link should not
 * depend on the app's stylesheet to be readable.
 */

const REASONS: Record<string, { status: number; title: string; body: string }> = {
  revoked: {
    status: 410,
    title: 'This link has been taken back',
    body: 'The person who shared it has withdrawn access. Ask them for a new one.',
  },
  expired: {
    status: 410,
    title: 'This link has expired',
    body: 'Shared summaries are deliberately short-lived. Ask for a fresh link.',
  },
  rate_limited: {
    status: 429,
    title: 'Too many tries',
    body: 'Please wait a minute and open the link again.',
  },
  not_found: {
    status: 404,
    title: 'Nothing here',
    body: 'This link is not valid.',
  },
}

const escape = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

export async function GET(req: Request) {
  const reason = new URL(req.url).searchParams.get('reason') ?? 'not_found'
  const { status, title, body } = REASONS[reason] ?? REASONS.not_found

  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escape(title)}</title>
<style>
  body { margin:0; background:#fff; color:#111;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
    display:flex; align-items:center; justify-content:center; min-height:100vh; padding:24px; }
  main { max-width:32rem; text-align:center; }
  h1 { font-size:20px; font-weight:600; margin:0; }
  p { font-size:15px; line-height:1.45; color:#555; margin:8px 0 0; }
</style>
</head><body><main>
<h1>${escape(title)}</h1>
<p>${escape(body)}</p>
</main></body></html>`

  return new Response(html, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  })
}
