// lib/storage.ts
import { getSupabaseClient } from "./supabase";

const BUCKET = "photos";
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60;

export async function uploadPhoto(itemId: string, file: File): Promise<string> {
  const supabase = getSupabaseClient();
  const path = `${itemId}/${Date.now()}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, Buffer.from(arrayBuffer), { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function getSignedPhotoUrl(path: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}
