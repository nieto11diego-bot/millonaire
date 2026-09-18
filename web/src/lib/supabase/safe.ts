import { createClient } from "@/lib/supabase/server";

/** Soft-fail when env vars are missing (local preview without Supabase). */
export async function createClientSafe() {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return null;
  }
  return createClient();
}
