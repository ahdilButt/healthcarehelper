import { NextResponse } from 'next/server'
import { ApiError, readJson, required, route } from '@/lib/api/errors'
import { requireMember } from '@/lib/api/guards'
import { isValidTime } from '@/lib/routines/time'

/** POST /api/routines — a schedule for one medicine (API-CONTRACTS.md). */
export const POST = route(async (req: Request) => {
  const body = await readJson<{ personId?: string; medicationId?: string; times?: string[] }>(req)
  const personId = String(required(body.personId, 'personId'))
  const medicationId = String(required(body.medicationId, 'medicationId'))

  const times = body.times ?? []
  if (!Array.isArray(times) || !times.length) {
    throw new ApiError('invalid_input', 'Choose at least one time of day.')
  }
  if (!times.every(isValidTime)) {
    throw new ApiError('invalid_input', 'Times look like 08:00.')
  }

  const member = await requireMember(personId)

  // The medicine must belong to this person — a routine is how a reminder
  // finds a phone, so a cross-record id here would text the wrong family.
  const { data: med } = await member.db
    .from('medications')
    .select('id')
    .eq('id', medicationId)
    .eq('person_id', personId)
    .maybeSingle()
  if (!med) throw new ApiError('not_found', 'That medicine was not found.')

  const { data, error } = await member.db
    .from('routines')
    .insert({ person_id: personId, medication_id: medicationId, times: unique(times) })
    .select('id, medication_id, times, enabled')
    .single()
  if (error || !data) throw new ApiError('processing_failed', 'Could not save that.')

  return NextResponse.json({ routine: data })
})

const unique = (times: string[]) => [...new Set(times)].sort()
