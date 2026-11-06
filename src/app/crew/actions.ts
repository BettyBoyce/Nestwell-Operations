"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireParent, requireProfile, KID_EMAIL_DOMAIN } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_PHOTOS = 6;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (path: string, msg: string): never => redirect(`${path}?error=${encodeURIComponent(msg)}`);
const done = (path = "/crew") => revalidatePath(path, "layout");

// ───────── Kid actions (rules enforced by Postgres functions) ─────────
export async function claimJob(jobId: string) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("claim_job", { p_job: jobId });
  if (error) fail("/crew", error.message);
  done();
}

export async function clockIn(jobId: string) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("clock_in", { p_job: jobId });
  if (error) fail("/crew", error.message);
  done();
}

export async function clockOut() {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("clock_out");
  if (error) fail("/crew", error.message);
  done();
}

export async function submitJob(jobId: string, formData: FormData) {
  const { supabase, profile } = await requireProfile();
  const files = formData
    .getAll("proof")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_PHOTOS);

  const paths: string[] = [];
  const stamp = Date.now();
  for (const [i, file] of files.entries()) {
    if (file.size > 4 * 1024 * 1024) fail("/crew", "A photo is too big. Try taking it again.");
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `${profile.family_id}/${jobId}/${stamp}-${i + 1}.${ext}`;
    const { error: upErr } = await supabase.storage.from("proof").upload(path, file, { contentType: file.type || "image/jpeg" });
    if (upErr) {
      if (paths.length) await supabase.storage.from("proof").remove(paths);
      fail("/crew", `Photo upload failed: ${upErr.message}`);
    }
    paths.push(path);
  }

  let { error } = await supabase.rpc("submit_job", { p_job: jobId, p_proofs: paths });
  if (error && /could not find the function/i.test(error.message)) {
    // Database not yet updated with 0002_required_photos.sql — use the original single-photo version.
    ({ error } = await supabase.rpc("submit_job", { p_job: jobId, p_proof: paths[0] ?? null }));
  }
  if (error) {
    if (paths.length) await supabase.storage.from("proof").remove(paths);
    fail("/crew", error.message);
  }
  done();
}

export async function markAllRead() {
  const { supabase, profile } = await requireProfile();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() })
    .eq("user_id", profile.id).is("read_at", null);
  done();
}

// ───────── Parent actions ─────────
export async function createJob(formData: FormData) {
  const { supabase, profile } = await requireParent();
  const title = str(formData, "title");
  const pay = Number(str(formData, "pay_amount"));
  if (!title) fail("/crew", "Give the job a title.");
  if (!Number.isFinite(pay) || pay < 0) fail("/crew", "Enter a valid pay amount.");
  const assigned = str(formData, "assigned_to");
  const row = {
    family_id: profile.family_id,
    title,
    description: str(formData, "description") || null,
    category: str(formData, "category") || "General",
    pay_type: str(formData, "pay_type") === "hourly" ? "hourly" : "flat",
    pay_amount: pay,
    assigned_to: assigned || null,
    status: assigned ? "claimed" : "open",
    due_date: str(formData, "due_date") || null,
    photo_required: !formData.get("photo_optional"),
    created_by: profile.id,
  };
  let { error } = await supabase.from("jobs").insert(row);
  if (error && /photo_required/.test(error.message)) {
    // Database not yet updated with 0002_required_photos.sql
    const { photo_required: _skip, ...rest } = row;
    void _skip;
    ({ error } = await supabase.from("jobs").insert(rest));
  }
  if (error) fail("/crew", error.message);
  done();
}

export async function approveJob(jobId: string) {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("approve_job", { p_job: jobId });
  if (error) fail("/crew", error.message);
  done();
}

export async function sendBackJob(jobId: string, formData: FormData) {
  const { supabase } = await requireParent();
  const { error } = await supabase.rpc("send_back_job", { p_job: jobId, p_note: str(formData, "note") || null });
  if (error) fail("/crew", error.message);
  done();
}

export async function deleteJob(jobId: string) {
  const { supabase } = await requireParent();
  const { error } = await supabase.from("jobs").delete().eq("id", jobId).neq("status", "approved");
  if (error) fail("/crew", error.message);
  done();
}

export async function recordPayout(formData: FormData) {
  const { supabase, profile } = await requireParent();
  const amount = Number(str(formData, "amount"));
  if (!(amount > 0)) fail("/crew/team", "Enter a payout amount.");
  const { error } = await supabase.from("payouts").insert({
    family_id: profile.family_id,
    kid_id: str(formData, "kid_id"),
    amount,
    method: str(formData, "method") || null,
    note: str(formData, "note") || null,
    created_by: profile.id,
  });
  if (error) fail("/crew/team", error.message);
  done();
}

export async function addKid(formData: FormData) {
  const { profile } = await requireParent();
  const name = str(formData, "display_name");
  const username = str(formData, "username").toLowerCase();
  const password = str(formData, "password");
  if (!name) fail("/crew/team", "Enter the crew member's name.");
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) fail("/crew/team", "Username: 3–30 letters, numbers, dots or dashes.");
  if (password.length < 6) fail("/crew/team", "Password must be at least 6 characters (numbers are fine).");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: `${username}@${KID_EMAIL_DOMAIN}`,
    password,
    email_confirm: true,
  });
  if (error || !data.user) fail("/crew/team", error?.message.includes("already") ? "That username is taken." : error?.message ?? "Could not add crew member.");

  const birthYear = Number(str(formData, "birth_year")) || null;
  const { error: pErr } = await admin.from("profiles").insert({
    id: data.user!.id,
    family_id: profile.family_id,
    role: "kid",
    display_name: name,
    username,
    birth_year: birthYear,
  });
  if (pErr) {
    await admin.auth.admin.deleteUser(data.user!.id);
    fail("/crew/team", pErr.message);
  }
  done("/crew/team");
}
