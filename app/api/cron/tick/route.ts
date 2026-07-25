import { NextResponse } from 'next/server'
import { route } from '@/lib/api/errors'
import { requireCronSecret } from '@/lib/api/guards'
import { supabaseService } from '@/lib/supabase/service'
import { runTick } from '@/lib/notify/tick'

/**
 * POST /api/cron/tick — SYSTEM. pg_cron calls this every minute with the
 * shared secret (the schedule is at the bottom of supabase/schema.sql).
 *
 * The secret is checked before anything else touches the database, because
 * this is the one route in the app that can make it send messages.
 */
export const POST = route(async (req: Request) => {
  requireCronSecret(req)
  const result = await runTick(supabaseService())
  return NextResponse.json(result)
})
