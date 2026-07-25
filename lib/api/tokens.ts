import { randomBytes } from 'node:crypto'

/**
 * Unguessable URL tokens. BUILD-GUIDE §4 requires >=128 bits for capsule and
 * invite links — these are the only credentials that ever travel in a URL.
 * 24 bytes = 192 bits, base64url so they survive copy/paste and QR encoding.
 */
export function urlToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url')
}
