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

// ───────── Hourly shifts ─────────
export async function shiftClockIn() {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("shift_clock_in");
  if (error) fail("/crew", error.message);
  done();
}

export async function shiftClockOut() {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("shift_clock_out");
  if (error) fail("/crew", error.message);
  done();
}

/** Parent fixes a shift. Times are entered in the family's local time. */
export async function fixShift(shiftId: string, tz: string, formData: FormData) {
  const { supabase } = await requireParent();
  const date = str(formData, "date");
  const start = str(formData, "start");
  const end = str(formData, "end");
  if (!date || !start) fail("/crew/team", "Enter a date and clock-in time.");
  const toIso = (t: string) => zonedToIso(date, t, tz);
  const { error } = await supabase.rpc("fix_shift", {
    p_shift: shiftId,
    p_start: toIso(start),
    p_end: end ? toIso(end) : null,
    p_note: str(formData, "note") || null,
  });
  if (error) fail("/crew/team", error.message);
  done("/crew/team");
}

/** Parent adds a shift that was never clocked. Times are local (family time zone). */
export async function addShift(kidId: string, tz: string, formData: FormData) {
  const { supabase } = await requireParent();
  const date = str(formData, "date");
  const start = str(formData, "start");
  const end = str(formData, "end");
  if (!date || !start || !end) fail("/crew/team", "Enter the date, clock-in and clock-out times.");
  const { error } = await supabase.rpc("add_shift", {
    p_kid: kidId,
    p_start: zonedToIso(date, start, tz),
    p_end: zonedToIso(date, end, tz),
    p_note: str(formData, "note") || null,
  });
  if (error) fail("/crew/team", error.message);
  done("/crew/team");
}

export async function deleteShift(shiftId: string) {
  const { supabase } = await requireParent();
  const { error } = await supabase.from("shifts").delete().eq("id", shiftId);
  if (error) fail("/crew/team", error.message);
  done("/crew/team");
}

/** Convert a local wall-clock date + time in `tz` to an ISO instant. */
function zonedToIso(ymd: string, hhmm: string, tz: string) {
  const guess = new Date(`${ymd}T${hhmm}:00Z`);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(guess);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return new Date(guess.getTime() - (asLocal - guess.getTime())).toISOString();
}

// ───────── Routines ─────────
export async function toggleRoutine(routineId: string, date: string) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("toggle_routine", { p_routine: routineId, p_date: date });
  if (error) fail("/crew", error.message);
  done();
}

export async function addRoutine(kidId: string, formData: FormData) {
  const { supabase, profile } = await requireParent();
  const title = str(formData, "title");
  if (!title) fail("/crew/team", "Enter the routine task.");
  const days = formData.getAll("days").map(Number).filter((d) => d >= 1 && d <= 7);
  const { error } = await supabase.from("routines").insert({
    family_id: profile.family_id,
    kid_id: kidId,
    title,
    days: days.length ? days : [1, 2, 3, 4, 5],
    sort: Date.now() % 100000,
  });
  if (error) fail("/crew/team", error.message);
  done("/crew/team");
}

export async function removeRoutine(routineId: string) {
  const { supabase } = await requireParent();
  // Keep history: deactivate instead of deleting.
  const { error } = await supabase.from("routines").update({ active: false }).eq("id", routineId);
  if (error) fail("/crew/team", error.message);
  done("/crew/team");
}

// ───────── Pay setup per crew member ─────────
export async function updatePaySetup(memberId: string, formData: FormData) {
  const { supabase } = await requireParent();
  const payType = str(formData, "pay_type");
  if (!["per_job", "hourly", "payroll"].includes(payType)) fail("/crew/team", "Choose how this person is paid.");
  const rate = str(formData, "hourly_rate");
  if (payType === "hourly" && !(Number(rate) > 0)) fail("/crew/team", "Enter an hourly rate.");
  const { error } = await supabase
    .from("profiles")
    .update({
      pay_type: payType,
      hourly_rate: rate ? Number(rate) : null,
      work_days: formData.getAll("work_days").map(Number).filter((d) => d >= 1 && d <= 7),
      shift_start: str(formData, "shift_start") || null,
      shift_end: str(formData, "shift_end") || null,
      position_title: str(formData, "position_title") || null,
    })
    .eq("id", memberId);
  if (error) fail("/crew/team", error.message);
  done("/crew/team");
}

/** One-tap "Mark paid" for an hourly crew member's balance. */
export async function payBalance(kidId: string, amount: number, note: string, formData: FormData) {
  const { supabase, profile } = await requireParent();
  if (!(amount > 0)) fail("/crew", "Nothing owed right now.");
  const { error } = await supabase.from("payouts").insert({
    family_id: profile.family_id,
    kid_id: kidId,
    amount: Math.round(amount * 100) / 100,
    method: str(formData, "method") || null,
    note,
    created_by: profile.id,
  });
  if (error) fail("/crew", error.message);
  done();
}
