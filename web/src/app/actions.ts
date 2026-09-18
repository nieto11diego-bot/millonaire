"use server";

import { redirect } from "next/navigation";
import { createClientSafe } from "@/lib/supabase/safe";

export async function signOut() {
  const supabase = await createClientSafe();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}
