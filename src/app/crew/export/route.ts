import { NextResponse } from "next/server";
import { requireParent } from "@/lib/auth";
import { hoursForJob, loadCrew } from "../data";

const csv = (rows: (string | number | null | undefined)[][]) =>
  rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");

/** Work + pay records for the year, for the CPA. ?year=2026 */
export async function GET(req: Request) {
  await requireParent();
  const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
  const { familyName, members, jobs, time, payouts } = await loadCrew();
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? "";
  const inYear = (d: string | null) => !!d && new Date(d).getFullYear() === year;

  const work = jobs
    .filter((j) => j.status === "approved" && inYear(j.approved_at))
    .map((j) => [
      "WORK", j.approved_at?.slice(0, 10), nameOf(j.assigned_to), j.title, j.category, j.description,
      hoursForJob(time, j.id).toFixed(2), j.pay_type, j.pay_amount, j.earned_amount,
    ]);
  const paid = payouts
    .filter((p) => inYear(p.paid_at))
    .map((p) => ["PAYOUT", p.paid_at.slice(0, 10), nameOf(p.kid_id), p.note, p.method, "", "", "", "", p.amount]);

  const body = csv([
    [`${familyName} — Nestwell Crew records ${year}`],
    ["type", "date", "kid", "job / note", "category / method", "description", "hours", "pay type", "rate", "amount"],
    ...work,
    ...paid,
  ]);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nestwell-crew-${year}.csv"`,
    },
  });
}
