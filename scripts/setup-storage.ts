import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
  const { data: existing } = await db.storage.listBuckets()
  if ((existing ?? []).some(b => b.name === 'documents')) { console.log("bucket 'documents' already exists"); return }
  const { error } = await db.storage.createBucket('documents', {
    public: false,
    fileSizeLimit: '30MB',
    allowedMimeTypes: ['image/jpeg','image/png','image/webp','image/heic','application/pdf','audio/webm','audio/mpeg','audio/mp4','audio/wav','audio/ogg'],
  })
  if (error) { console.error('FAILED:', error.message); process.exit(1) }
  console.log("created private bucket 'documents'")
}
main()
