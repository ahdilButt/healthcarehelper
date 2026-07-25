import { redirect } from 'next/navigation'
import { currentPerson } from '@/lib/person'
import { supabaseServer } from '@/lib/supabase/server'
import { ensureRoutines } from '@/lib/routines/schedule'
import { buildToday } from '@/lib/routines/today'
import { TodayList } from '@/components/today/today-list'

export default async function TodayPage() {
  const { person } = await currentPerson()
  if (!person) redirect('/onboarding')

  const db = await supabaseServer()
  // Schedules build themselves from the letters the first time anyone looks.
  await ensureRoutines(db, person.id)
  const { groups } = await buildToday(db, person.id)

  return <TodayList personId={person.id} personName={person.displayName} initialGroups={groups} />
}
