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
export type Member = { id: string; display_name: string; role: "parent" | "kid"; username: string | null; birth_year: number | null };

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

export async function loadCrew() {
  const { supabase, profile } = await requireProfile();
  const [family, members, jobs, time, payouts, notes] = await Promise.all([
    supabase.from("families").select("name").eq("id", profile.family_id).single(),
    supabase.from("profiles").select("id, display_name, role, username, birth_year").order("created_at"),
    supabase.from("jobs").select("*").order("created_at", { ascending: false }).limit(300),
    supabase.from("time_entries").select("id, job_id, kid_id, started_at, ended_at").order("started_at", { ascending: false }).limit(1000),
    supabase.from("payouts").select("id, kid_id, amount, method, note, paid_at").order("paid_at", { ascending: false }),
    supabase.from("notifications").select("id, message, read_at, created_at").order("created_at", { ascending: false }).limit(20),
  ]);
  return {
    supabase,
    profile,
    familyName: family.data?.name ?? "Your family",
    members: (members.data ?? []) as Member[],
    jobs: (jobs.data ?? []) as Job[],
    time: (time.data ?? []) as TimeEntry[],
    payouts: (payouts.data ?? []) as Payout[],
    notifications: (notes.data ?? []) as Notification[],
  };
}

export function hoursForJob(time: TimeEntry[], jobId: string) {
  return time
    .filter((t) => t.job_id === jobId)
    .reduce((h, t) => h + ((t.ended_at ? new Date(t.ended_at).getTime() : Date.now()) - new Date(t.started_at).getTime()) / 3_600_000, 0);
}

export function kidTotals(kidId: string, jobs: Job[], time: TimeEntry[], payouts: Payout[]) {
  const earned = jobs.filter((j) => j.assigned_to === kidId && j.status === "approved")
    .reduce((s, j) => s + Number(j.earned_amount ?? 0), 0);
  const paid = payouts.filter((p) => p.kid_id === kidId).reduce((s, p) => s + Number(p.amount), 0);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const hoursThisMonth = time
    .filter((t) => t.kid_id === kidId && t.ended_at && new Date(t.started_at).getTime() >= monthStart)
    .reduce((h, t) => h + (new Date(t.ended_at!).getTime() - new Date(t.started_at).getTime()) / 3_600_000, 0);
  const activeTimer = time.find((t) => t.kid_id === kidId && !t.ended_at) ?? null;
  return { earned, paid, owed: earned - paid, hoursThisMonth, activeTimer };
}

export const payLabel = (j: Pick<Job, "pay_type" | "pay_amount">) =>
  `$${Number(j.pay_amount).toFixed(2)}${j.pay_type === "hourly" ? "/hr" : ""}`;
