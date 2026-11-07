import { requireProfile } from "@/lib/auth";

export type Job = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  pay_type: "flat" | "hourly";
  pay_amount: number;
  assigned_to: string | null;
  status: "open" | "claimed" | "submitted" | "approved";
  due_date: string | null;
  proof_path: string | null;
  proof_paths: string[] | null;
  photo_required: boolean | null;
  parent_note: string | null;
  earned_amount: number | null;
  submitted_at: string | null;
  approved_at: string | null;
  created_at: string;
};
export type TimeEntry = { id: string; job_id: string; kid_id: string; started_at: string; ended_at: string | null };
export type Payout = { id: string; kid_id: string; amount: number; method: string | null; note: string | null; paid_at: string };
export type Notification = { id: string; message: string; read_at: string | null; created_at: string };
export type PayType = "per_job" | "hourly" | "payroll";
export type Member = {
  id: string;
  display_name: string;
  role: "parent" | "kid";
  username: string | null;
  birth_year: number | null;
  pay_type?: PayType | null;
  hourly_rate?: number | null;
  work_days?: number[] | null;
  shift_start?: string | null;
  shift_end?: string | null;
  position_title?: string | null;
  daily_rate?: number | null;
};
export type Shift = {
  id: string;
  kid_id: string;
  started_at: string;
  ended_at: string | null;
  rate: number;
  amount: number | null;
  note: string | null;
};
export type Routine = { id: string; kid_id: string; title: string; days: number[]; sort: number; active: boolean; created_at?: string };
export type RoutineCheck = { id: string; routine_id: string; kid_id: string; check_date: string; checked_at: string };
/** A fully-completed routine day and what it earned (migration 0004). */
export type RoutineDay = { id: string; kid_id: string; day: string; rate: number; amount: number; completed_at: string };

export const JOB_CATEGORIES = [
  "Turnover",
  "Restock",
  "Laundry",
  "Photos & Content",
  "Welcome Kits",
  "Yard & Exterior",
  "Office & Admin",
  "General",
];

export const PAY_METHODS = ["Venmo", "Check", "Cash", "Payroll"];

export const DAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]; // ISO 1–7

export async function loadCrew() {
  const { supabase, profile } = await requireProfile();
  const [family, members, jobs, time, payouts, notes, shifts, routines, checks, routineDays] = await Promise.all([
    supabase.from("families").select("*").eq("id", profile.family_id).single(),
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("time_entries").select("id, job_id, kid_id, started_at, ended_at").order("started_at", { ascending: false }).limit(1000),
    supabase.from("payouts").select("id, kid_id, amount, method, note, paid_at").order("paid_at", { ascending: false }),
    supabase.from("notifications").select("id, message, read_at, created_at").order("created_at", { ascending: false }).limit(20),
    // These three come from migration 0003; if it hasn't been run they simply return nothing.
    supabase.from("shifts").select("*").order("started_at", { ascending: false }).limit(500),
    supabase.from("routines").select("*").eq("active", true).order("sort"),
    supabase.from("routine_checks").select("*").gte("check_date", isoDaysAgo(45)),
    supabase.from("routine_days").select("*").order("day", { ascending: false }).limit(2000),
  ]);
  const me = ((members.data ?? []) as Member[]).find((m) => m.id === profile.id);
  // Database updates that haven't been run yet (shown to parents as a banner).
  const pendingUpdates: string[] = [];
  if (jobs.data?.length && !("photo_required" in (jobs.data[0] as object))) pendingUpdates.push("0002_required_photos.sql");
  if (shifts.error || routines.error) pendingUpdates.push("0003_pay_types_shifts_routines.sql");
  if (routineDays.error) pendingUpdates.push("0004_daily_rate_and_claim_rule.sql");
  return {
    supabase,
    profile: { ...profile, ...me } as typeof profile & Member,
    familyName: (family.data?.name as string) ?? "Your family",
    timezone: (family.data?.timezone as string) || "America/Los_Angeles",
    members: (members.data ?? []) as Member[],
    jobs: (jobs.data ?? []) as Job[],
    time: (time.data ?? []) as TimeEntry[],
    payouts: (payouts.data ?? []) as Payout[],
    notifications: (notes.data ?? []) as Notification[],
    shifts: (shifts.data ?? []) as Shift[],
    routines: (routines.data ?? []) as Routine[],
    checks: (checks.data ?? []) as RoutineCheck[],
    routineDays: (routineDays.data ?? []) as RoutineDay[],
    pendingUpdates,
  };
}

function isoDaysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

// ───────── Time zone helpers (business runs on family time, e.g. Pacific) ─────────
/** YYYY-MM-DD for an instant, in the family's time zone. */
export function localDate(tz: string, d: Date | string = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    typeof d === "string" ? new Date(d) : d,
  );
}
/** ISO weekday 1 (Mon) … 7 (Sun) for a YYYY-MM-DD date. */
export function isoDow(ymd: string) {
  const d = new Date(ymd + "T12:00:00Z").getUTCDay();
  return d === 0 ? 7 : d;
}
export function addDays(ymd: string, n: number) {
  const d = new Date(ymd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const prettyDate = (ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) =>
  new Date(ymd + "T12:00:00Z").toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
export const prettyTime = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
/** "10:00:00" → "10 AM" */
export function clock(t: string | null | undefined) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")} ${ampm}` : `${hh} ${ampm}`;
}
export function scheduleLabel(m: Member) {
  const days = (m.work_days ?? []).slice().sort().map((d) => DAY_NAMES[d]);
  if (!days.length) return "";
  const time = m.shift_start && m.shift_end ? ` · ${clock(m.shift_start)}–${clock(m.shift_end)}` : "";
  return days.join(" & ") + time;
}

/** Pay week runs Saturday → Friday, so Friday's shift is in that Friday's pay. */
export function payWeek(tz: string, offsetWeeks = 0) {
  const today = localDate(tz);
  const dow = isoDow(today); // Mon=1 … Sat=6, Sun=7
  const sinceSat = (dow + 1) % 7; // Sat=0, Sun=1, Mon=2 … Fri=6
  const start = addDays(today, -sinceSat - 7 * offsetWeeks);
  const end = addDays(start, 6);
  return { start, end, today, label: `${prettyDate(start, { month: "short", day: "numeric" })} – ${prettyDate(end, { month: "short", day: "numeric" })}` };
}
/** Monday–Sunday week containing today (for routine check-offs). */
export function routineWeek(tz: string) {
  const today = localDate(tz);
  const monday = addDays(today, -(isoDow(today) - 1));
  return { today, days: Array.from({ length: 7 }, (_, i) => addDays(monday, i)) };
}

/** Is this routine due on a date? Not before the day it was created (so new routines don't show past days as missed). */
export const routineOn = (r: Routine, ymd: string, tz: string) =>
  r.days.includes(isoDow(ymd)) && (!r.created_at || localDate(tz, r.created_at) <= ymd);

/** Monday–Friday of this week (or of the coming week on Saturday/Sunday). */
export function routineWeekdays(tz: string) {
  const today = localDate(tz);
  const dow = isoDow(today);
  const monday = dow >= 6 ? addDays(today, 8 - dow) : addDays(today, 1 - dow);
  return { today, days: [0, 1, 2, 3, 4].map((i) => addDays(monday, i)), thisMonday: addDays(today, 1 - dow) };
}

export const shiftHours = (s: Pick<Shift, "started_at" | "ended_at">) =>
  ((s.ended_at ? new Date(s.ended_at).getTime() : Date.now()) - new Date(s.started_at).getTime()) / 3_600_000;

export function weekShifts(shifts: Shift[], kidId: string, tz: string, offsetWeeks = 0) {
  const w = payWeek(tz, offsetWeeks);
  const list = shifts
    .filter((s) => s.kid_id === kidId)
    .filter((s) => {
      const d = localDate(tz, s.started_at);
      return d >= w.start && d <= w.end;
    })
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const hours = list.filter((s) => s.ended_at).reduce((h, s) => h + shiftHours(s), 0);
  const amount = list.reduce((a, s) => a + Number(s.amount ?? 0), 0);
  return { ...w, list, hours, amount };
}

export function hoursForJob(time: TimeEntry[], jobId: string) {
  return time
    .filter((t) => t.job_id === jobId)
    .reduce((h, t) => h + ((t.ended_at ? new Date(t.ended_at).getTime() : Date.now()) - new Date(t.started_at).getTime()) / 3_600_000, 0);
}

export function kidTotals(
  kidId: string,
  jobs: Job[],
  time: TimeEntry[],
  payouts: Payout[],
  shifts: Shift[] = [],
  routineDays: RoutineDay[] = [],
) {
  const jobEarned = jobs
    .filter((j) => j.assigned_to === kidId && j.status === "approved")
    .reduce((s, j) => s + Number(j.earned_amount ?? 0), 0);
  const mine = shifts.filter((s) => s.kid_id === kidId);
  const shiftEarned = mine.reduce((s, x) => s + Number(x.amount ?? 0), 0);
  const myDays = routineDays.filter((d) => d.kid_id === kidId);
  const routineEarned = myDays.reduce((s, d) => s + Number(d.amount), 0);
  const earned = jobEarned + shiftEarned + routineEarned;
  const paid = payouts.filter((p) => p.kid_id === kidId).reduce((s, p) => s + Number(p.amount), 0);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const jobHours = time
    .filter((t) => t.kid_id === kidId && t.ended_at && new Date(t.started_at).getTime() >= monthStart)
    .reduce((h, t) => h + (new Date(t.ended_at!).getTime() - new Date(t.started_at).getTime()) / 3_600_000, 0);
  const shiftHoursMonth = mine
    .filter((s) => s.ended_at && new Date(s.started_at).getTime() >= monthStart)
    .reduce((h, s) => h + shiftHours(s), 0);
  const monthDays = myDays.filter((d) => d.day.startsWith(monthKey));
  const activeTimer = time.find((t) => t.kid_id === kidId && !t.ended_at) ?? null;
  const openShift = mine.find((s) => !s.ended_at) ?? null;
  const balance = Math.round((earned - paid) * 100) / 100;
  return {
    earned,
    jobEarned,
    routineEarned,
    routineDaysThisMonth: monthDays.length,
    routineEarnedThisMonth: monthDays.reduce((s, d) => s + Number(d.amount), 0),
    paid,
    owed: Math.max(0, balance), // never shown as negative
    paidAhead: Math.max(0, -balance), // paid before it was earned (e.g. monthly payroll paid up front)
    hoursThisMonth: jobHours + shiftHoursMonth,
    activeTimer,
    openShift,
  };
}

export const payLabel = (j: Pick<Job, "pay_type" | "pay_amount">) =>
  `$${Number(j.pay_amount).toFixed(2)}${j.pay_type === "hourly" ? "/hr" : ""}`;
