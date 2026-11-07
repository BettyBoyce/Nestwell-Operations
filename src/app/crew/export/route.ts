import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth";
import { hoursForJob, loadCrew, localDate, shiftHours, type Routine, type RoutineCheck, type RoutineDay, type Shift } from "../data";

const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

/** Work + pay records for the year, for the CPA. ?year=2026 */
export async function GET(req: Request) {
  await requireParent();
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
  const { supabase, familyName, timezone: tz, members, jobs, time, payouts } = await loadCrew();
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? "";
  const positionOf = (id: string | null) => members.find((m) => m.id === id)?.position_title ?? "";
  const inYear = (d: string | null) => !!d && localDate(tz, d).startsWith(String(year));
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  // Full-year shift and routine records (the dashboard only loads recent ones).
  const [shiftsRes, routinesRes, checksRes, daysRes] = await Promise.all([
    supabase.from("shifts").select("*").gte("started_at", `${year - 1}-12-31`).lte("started_at", `${year + 1}-01-01`).order("started_at"),
    supabase.from("routines").select("*"),
    supabase.from("routine_checks").select("*").gte("check_date", from).lte("check_date", to).order("check_date"),
    supabase.from("routine_days").select("*").gte("day", from).lte("day", to).order("day"),
  ]);
  const routineDays = (daysRes.data ?? []) as RoutineDay[];
  const shifts = (shiftsRes.data ?? []) as Shift[];
  const routines = (routinesRes.data ?? []) as Routine[];
  const checks = (checksRes.data ?? []) as RoutineCheck[];
  const t = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });

  const work = jobs
    .filter((j) => j.status === "approved" && inYear(j.approved_at))
    .map((j) => [
      "JOB", localDate(tz, j.approved_at!), nameOf(j.assigned_to), positionOf(j.assigned_to), j.title, j.category,
      hoursForJob(time, j.id).toFixed(2), j.pay_type, j.pay_amount, j.earned_amount,
    ]);
  const shiftRows = shifts
    .filter((s) => s.ended_at && inYear(s.started_at))
    .map((s) => [
      "SHIFT", localDate(tz, s.started_at), nameOf(s.kid_id), positionOf(s.kid_id),
      `${t(s.started_at)} – ${t(s.ended_at!)}${s.note ? ` (${s.note})` : ""}`, "Hourly shift",
      shiftHours(s).toFixed(2), "hourly", s.rate, s.amount,
    ]);
  const routineRows = checks.map((c) => {
    const r = routines.find((x) => x.id === c.routine_id);
    return [
      "ROUTINE", c.check_date, nameOf(c.kid_id), positionOf(c.kid_id), r?.title ?? "Routine task",
      `Checked off ${localDate(tz, c.checked_at) === c.check_date ? "same day" : "on " + localDate(tz, c.checked_at)}`,
      "", "payroll", "", "",
    ];
  });
  const dayRows = routineDays.map((x) => [
    "ROUTINE DAY", x.day, nameOf(x.kid_id), positionOf(x.kid_id), "All routine tasks completed", "Daily rate", "", "payroll", x.rate, x.amount,
  ]);
  const paid = payouts
    .filter((p) => inYear(p.paid_at))
    .map((p) => ["PAYOUT", localDate(tz, p.paid_at), nameOf(p.kid_id), positionOf(p.kid_id), p.note, p.method, "", "", "", p.amount]);

  const byDate = (a: (string | number | null | undefined)[], b: (string | number | null | undefined)[]) =>
    String(a[1]).localeCompare(String(b[1]));

  const body = csv([
    [`${familyName} — Nestwell Crew records ${year}`],
    ["type", "date", "crew member", "position", "work / note", "category / method / detail", "hours", "pay type", "rate", "amount"],
    ...[...work, ...shiftRows, ...routineRows, ...dayRows, ...paid].sort(byDate),
  ]);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nestwell-crew-${year}.csv"`,
    },
  });
}
