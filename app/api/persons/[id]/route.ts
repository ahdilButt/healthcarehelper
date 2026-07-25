import { NextResponse } from 'next/server'
import { ApiError, readJson, route } from '@/lib/api/errors'
import { requireOwner } from '@/lib/api/guards'

/**
 * PATCH /api/persons/:id — the two things about a person that no letter can
 * tell us: whether a DNACPR decision exists, and who to ring.
 *
 * SPEC-FINAL §7 calls DNR status "manually set" for exactly this reason. It is
 * owner-only, because it is the single most consequential line on the
 * emergency card and it is not extracted from anything.
 */
export const PATCH = route(async (req: Request, ctx: RouteContext<'/api/persons/[id]'>) => {
  const { id } = await ctx.params
  const body = await readJson<{
    dnrStatus?: boolean | null
    emergencyContact?: { name?: string; phone?: string; relationship?: string } | null
  }>(req)

  const patch: Record<string, unknown> = {}

  if ('dnrStatus' in body) {
    if (body.dnrStatus !== null && typeof body.dnrStatus !== 'boolean') {
      throw new ApiError('invalid_input', 'That is not a yes or a no.')
    }
    patch.dnr_status = body.dnrStatus
  }

  if ('emergencyContact' in body) {
    const contact = body.emergencyContact
    if (contact === null) patch.emergency_contact = null
    else {
      const name = String(contact?.name ?? '').trim()
      const phone = String(contact?.phone ?? '').trim()
      if (!name || !phone) throw new ApiError('invalid_input', 'A name and a number, please.')
      patch.emergency_contact = {
        name: name.slice(0, 120),
        phone: phone.slice(0, 40),
        relationship: String(contact?.relationship ?? '').trim().slice(0, 60) || undefined,
      }
    }
  }

  if (!Object.keys(patch).length) throw new ApiError('invalid_input', 'Nothing to change.')

  const owner = await requireOwner(id)
  const { data, error } = await owner.db
    .from('persons')
    .update(patch)
    .eq('id', id)
    .select('id, display_name, emergency_contact, dnr_status')
    .single()
  if (error || !data) throw new ApiError('processing_failed', 'Could not save that.')

  return NextResponse.json({
    person: {
      id: data.id,
      displayName: data.display_name,
      emergencyContact: data.emergency_contact,
      dnrStatus: data.dnr_status,
    },
  })
})
