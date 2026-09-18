import { NextResponse } from "next/server";
import { createClientSafe } from "@/lib/supabase/safe";

export async function GET() {
  const supabase = await createClientSafe();
  if (!supabase) {
    return NextResponse.json({ user: null, snapshot: null });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ user: null, snapshot: null });
  }

  const { data, error } = await supabase
    .from("saves")
    .select("snapshot, saved_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email },
    snapshot: data?.snapshot ?? null,
    savedAt: data?.saved_at ?? null,
  });
}

export async function PUT(request: Request) {
  const supabase = await createClientSafe();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { snapshot?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const snapshot = body.snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return NextResponse.json({ error: "missing_snapshot" }, { status: 400 });
  }

  const savedAtMs =
    typeof (snapshot as { savedAt?: unknown }).savedAt === "number"
      ? (snapshot as { savedAt: number }).savedAt
      : Date.now();

  const { error } = await supabase.from("saves").upsert(
    {
      user_id: user.id,
      snapshot,
      saved_at: new Date(savedAtMs).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const supabase = await createClientSafe();
  if (!supabase) {
    return NextResponse.json({ error: "supabase_not_configured" }, { status: 503 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("saves").delete().eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
