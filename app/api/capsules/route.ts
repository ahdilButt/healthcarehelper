import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { urlToken } from '@/lib/api/tokens'
import { CAPSULE_EXPIRY_HOURS } from '@/lib/constants'
import type { CapsuleKind } from '@/lib/types'

const KINDS: CapsuleKind[] = ['doctor_brief', 'paramedic', 'family']

export function capsuleUrl(token: string): string {
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  return `${base}/c/${token}`
}

/**
 * POST /api/capsules — make a share link (SPEC-FINAL §7).
 *
 * The QR is generated here rather than in the browser so the thing the doctor
 * scans and the thing the link points at can never disagree.
 */
export const POST = route(async (req: Request) => {
  const body = await readJson<{ personId?: string; kind?: CapsuleKind }>(req)
  const personId = String(required(body.personId, 'personId'))
  const kind = String(required(body.kind, 'kind')) as CapsuleKind
  if (!KINDS.includes(kind)) throw new ApiError('invalid_input', 'Unknown kind of link.')

  const member = await requireMember(personId)

  const hours = CAPSULE_EXPIRY_HOURS[kind]
  const expiresAt =
    hours === null ? null : new Date(Date.now() + hours * 3600 * 1000).toISOString()

  const token = urlToken()
  const { data, error } = await member.db
    .from('capsules')
    .insert({
      person_id: personId,
      kind,
      token,
      expires_at: expiresAt,
      created_by: member.userId,
    })
    .select('id, kind, token, expires_at')
    .single()
  if (error || !data) throw new ApiError('processing_failed', 'Could not make that link.')

  const url = capsuleUrl(data.token)
  const qrPngDataUrl = await QRCode.toDataURL(url, { width: 512, margin: 1 })

  return NextResponse.json({
    capsule: { id: data.id, kind: data.kind, url, token: data.token, expiresAt: data.expires_at },
    qrPngDataUrl,
  })
})
