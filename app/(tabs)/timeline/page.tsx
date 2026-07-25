import { redirect } from 'next/navigation'
import { currentPerson } from '@/lib/person'
import { supabaseServer } from '@/lib/supabase/server'
import { buildTimeline } from '@/lib/timeline/build'
import { TimelineFeed } from '@/components/timeline/timeline-feed'

export default async function TimelinePage({ searchParams }: PageProps<'/timeline'>) {
  const { person } = await currentPerson()
  if (!person) redirect('/onboarding')

  const db = await supabaseServer()
  const items = await buildTimeline(db, person.id, 60)
  const params = await searchParams

  return (
    <TimelineFeed personId={person.id} initialItems={items} autoOpenCamera={params.add === '1'} />
  )
}
