import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseServiceKey, supabaseUrl } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/** Setup check. Reports only yes/no — never key values. */
export async function GET() {
  const checks = {
    supabase_url: Boolean(supabaseUrl()),
    public_key: Boolean(supabaseAnonKey()),
    server_key: Boolean(supabaseServiceKey()),
    database_tables: false,
    photo_bucket: false,
    crew_functions: false,
    required_photos_update: false,
    signup_open: process.env.ALLOW_SIGNUP !== "false",
  };
  const notes: string[] = [];

  if (checks.supabase_url && checks.server_key) {
    const admin = createClient(supabaseUrl(), supabaseServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.from("families").select("id", { count: "exact", head: true });
    checks.database_tables = !error;
    const { data: bucket, error: bucketErr } = await admin.storage.getBucket("proof");
    checks.photo_bucket = Boolean(bucket);
    if (bucketErr) notes.push(`photo_bucket: ${bucketErr.message}`);
    // Crew functions installed? (calling with no user returns a permission/"not available" error, not "not found")
    const { error: fnErr } = await admin.rpc("claim_job", { p_job: "00000000-0000-0000-0000-000000000000" });
    checks.crew_functions = !fnErr || !/could not find|does not exist/i.test(fnErr.message);
    if (!checks.crew_functions && fnErr) notes.push(`crew_functions: ${fnErr.message}`);
    const { error: colErr } = await admin.from("jobs").select("photo_required, proof_paths").limit(1);
    checks.required_photos_update = !colErr;
    if (colErr) notes.push("required_photos_update: run supabase/migrations/0002_required_photos.sql");
  }

  const ready =
    checks.supabase_url && checks.public_key && checks.server_key && checks.database_tables && checks.crew_functions;
  return NextResponse.json({ ready, ...checks, notes });
}
