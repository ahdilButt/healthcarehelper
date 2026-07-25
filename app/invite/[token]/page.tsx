import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseService } from '@/lib/supabase/service'
import { Card, CardHeader, Meta, PageTitle } from '@/components/ui/primitives'
import AcceptInvite from './accept-invite'

/**
 * Dad opens this on his own phone. He must sign in first (his own magic link),
 * then the token decides which record he joins.
 */
export default async function InvitePage({ params }: PageProps<'/invite/[token]'>) {
  const { token } = await params

  const db = await supabaseServer()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) redirect(`/signin?next=${encodeURIComponent(`/invite/${token}`)}`)

  // Read-only peek with service role so we can name the record before joining.
  const svc = supabaseService()
  const { data: invite } = await svc
    .from('invites')
    .select('person_id, role, expires_at, used_by, persons!inner(display_name)')
    .eq('token', token)
    .maybeSingle()

  const dead =
    !invite ||
    Boolean(invite.used_by) ||
    new Date(invite.expires_at as string) < new Date()

  if (dead) {
    return (
      <main className="hh-shell flex min-h-dvh flex-col justify-center gap-4 px-5">
        <PageTitle>This link has expired</PageTitle>
        <Meta>Ask whoever invited you to send a fresh one — they only work once.</Meta>
      </main>
    )
  }

  const person = invite.persons as unknown as { display_name: string }

  return (
    <main className="hh-shell flex min-h-dvh flex-col justify-center gap-5 px-5">
      <PageTitle>Join {person.display_name}&apos;s story</PageTitle>
      <Card>
        <CardHeader>You&apos;ve been invited</CardHeader>
        <Meta className="mt-2">
          You&apos;ll be able to see {person.display_name}&apos;s record, add letters, and mark
          medicines as taken.
        </Meta>
      </Card>
      <AcceptInvite token={token} />
    </main>
  )
}
