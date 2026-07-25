import { NextResponse } from 'next/server'

/** API-CONTRACTS.md: the universal error envelope. No bare 500 texts, ever. */
export type ApiErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_input'
  | 'expired'
  | 'revoked'
  | 'rate_limited'
  | 'processing_failed'

const STATUS: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  invalid_input: 400,
  expired: 410,
  revoked: 410,
  rate_limited: 429,
  processing_failed: 500,
}

export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function errorResponse(code: ApiErrorCode, message: string) {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code] })
}

/**
 * Wraps a route handler so every throw becomes the envelope.
 * Unknown errors are logged server-side and returned as processing_failed —
 * the message never leaks internals (no PII in logs, BUILD-GUIDE §4).
 */
export function route<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>
): (...args: A) => Promise<Response> {
  return async (...args: A) => {
    try {
      return await handler(...args)
    } catch (e) {
      if (e instanceof ApiError) return errorResponse(e.code, e.message)
      console.error('[api] unhandled', e instanceof Error ? e.message : e)
      return errorResponse('processing_failed', 'Something went wrong. Please try again.')
    }
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T
  } catch {
    throw new ApiError('invalid_input', 'Expected a JSON body.')
  }
}

export function required<T>(value: T | null | undefined, field: string): T {
  if (value === null || value === undefined || value === '') {
    throw new ApiError('invalid_input', `Missing required field: ${field}`)
  }
  return value
}
