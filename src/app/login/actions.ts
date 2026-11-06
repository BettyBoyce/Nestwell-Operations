"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loginToEmail } from "@/lib/auth";

const back = (path: string, msg: string): never => redirect(`${path}?error=${encodeURIComponent(msg)}`);

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: loginToEmail(String(formData.get("login") ?? "")),
    password: String(formData.get("password") ?? ""),
  });
  if (error) back("/login", "That login or password didn't match.");
  redirect("/crew");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Creates a family + the first parent account. Turn off with ALLOW_SIGNUP=false once set up. */
export async function signup(formData: FormData) {
  if (process.env.ALLOW_SIGNUP === "false") back("/signup", "Sign-up is closed. Ask a parent for an invite.");

  const familyName = String(formData.get("family") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!familyName || !name || !email) back("/signup", "Please fill in every field.");
  if (password.length < 6) back("/signup", "Password must be at least 6 characters (numbers are fine).");

  const admin = createAdminClient();
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !created.user) back("/signup", error?.message ?? "Could not create account.");

  const { data: family, error: famErr } = await admin.from("families").insert({ name: familyName }).select().single();
  if (famErr || !family) back("/signup", famErr?.message ?? "Could not create family.");

  const { error: profErr } = await admin
    .from("profiles")
    .insert({ id: created.user!.id, family_id: family!.id, role: "parent", display_name: name });
  if (profErr) back("/signup", profErr.message);

  const supabase = await createClient();
  await supabase.auth.signInWithPassword({ email, password });
  redirect("/crew/team");
}
