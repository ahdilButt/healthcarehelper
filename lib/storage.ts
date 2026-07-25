import type { SupabaseClient } from '@supabase/supabase-js'
import { DOCUMENTS_BUCKET, SIGNED_URL_TTL_SECONDS } from '@/lib/constants'

/**
 * The originals — stored, fetched and signed for.
 *
 * The bucket is private and carries no policies for authenticated users, which
 * is what supabase/schema.sql intends: "in practice the app uploads and reads
 * via server routes + signed URLs". So each of these needs the service-role
 * client, and every caller must have passed a membership check first. The path
 * is never a credential — a signed URL that lives two minutes is.
 *
 * The client is passed in rather than imported so that `server-only` stays on
 * lib/supabase/service.ts, where the key actually lives, and the demo scripts
 * can still drive the same code with a client of their own.
 */

export async function putDocument(
  service: SupabaseClient,
  path: string,
  bytes: ArrayBuffer,
  contentType: string
): Promise<{ ok: boolean; reason?: string }> {
  const { error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, bytes, { contentType: contentType || 'application/octet-stream', upsert: false })
  return error ? { ok: false, reason: error.message } : { ok: true }
}

export async function getDocument(service: SupabaseClient, path: string): Promise<Uint8Array> {
  const { data, error } = await service.storage.from(DOCUMENTS_BUCKET).download(path)
  if (error || !data) throw new Error(`download failed: ${error?.message ?? 'no file'}`)
  return new Uint8Array(await data.arrayBuffer())
}

export async function signedUrlFor(
  service: SupabaseClient,
  path: string
): Promise<string | null> {
  const { data, error } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
  return error || !data ? null : data.signedUrl
}
