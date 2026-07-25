import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const opts = {
    public: false,
    fileSizeLimit: '30MB',
    allowedMimeTypes: [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/pdf',
      'audio/webm',
      'audio/mpeg',
      'audio/mp4',
      'audio/wav',
      'audio/ogg',
      // the seeded voice-note transcript; live recordings arrive as audio/webm
      'text/plain',
    ],
  }
  const { data: existing } = await db.storage.listBuckets()
  if ((existing ?? []).some((b) => b.name === 'documents')) {
    const { error } = await db.storage.updateBucket('documents', opts)
    if (error) { console.error('FAILED to update bucket:', error.message); process.exit(1) }
    console.log("bucket 'documents' already existed — refreshed its settings")
    return
  }
  const { error } = await db.storage.createBucket('documents', opts)
  if (error) { console.error('FAILED:', error.message); process.exit(1) }
  console.log("created private bucket 'documents'")
}
main()
