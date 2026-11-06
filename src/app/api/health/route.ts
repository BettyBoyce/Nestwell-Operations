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
    signup_open: process.env.ALLOW_SIGNUP !== "false",
  };

  if (checks.supabase_url && checks.server_key) {
    const admin = createClient(supabaseUrl(), supabaseServiceKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await admin.from("families").select("id", { count: "exact", head: true });
    checks.database_tables = !error;
    const { data: bucket } = await admin.storage.getBucket("proof");
    checks.photo_bucket = Boolean(bucket);
  }

  const ready = checks.supabase_url && checks.public_key && checks.server_key && checks.database_tables;
  return NextResponse.json({ ready, ...checks });
}
