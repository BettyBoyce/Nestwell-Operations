import Link from "next/link";
import { notFound } from "next/navigation";
import { CrewHeader } from "@/components/CrewHeader";
import { money } from "@/lib/auth";
import {
  addDays,
  hoursForJob,
  isoDow,
  routineOn,
  loadCrew,
  localDate,
  payLabel,
  payWeek,
  prettyDate,
  scheduleLabel,
  shiftHours,
  type Routine,
} from "../../data";

export const MAX_WEEKS_BACK = 6;

type CrewData = Omit<Awaited<ReturnType<typeof loadCrew>>, "supabase">;

export async function MemberWeek({
  data,
  id,
  back,
  sign,
}: {
  data: CrewData;
  id: string;
  back: number;
  sign: (paths: string[]) => Promise<(string | null)[]>;
}) {
  const { profile, familyName, timezone: tz, members, jobs, time, payouts, notifications, shifts, routines, checks } = data;
  const earnedDays = data.routineDays ?? [];
  const m = members.find((x) => x.id === id && x.role === "kid");
  if (!m) notFound();

  // Hourly crew use the Saturday–Friday pay week; everyone else uses Monday–Sunday.
  const hourly = m.pay_type === "hourly";
  const { start, end, label } = hourly ? payWeek(tz, back) : calendarWeek(tz, back);
  const today = localDate(tz);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const inWeek = (iso: string | null) => {
    if (!iso) return false;
    const d = localDate(tz, iso);
    return d >= start && d <= end;
  };
  const t = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });

  // Shifts
  const weekShifts = shifts.filter((s) => s.kid_id === m.id && inWeek(s.started_at)).sort((a, b) => a.started_at.localeCompare(b.started_at));
  const shiftHrs = weekShifts.filter((s) => s.ended_at).reduce((h, s) => h + shiftHours(s), 0);
  const shiftPay = weekShifts.reduce((a, s) => a + Number(s.amount ?? 0), 0);

  // Jobs
  const mine = jobs.filter((j) => j.assigned_to === m.id);
  const approved = mine.filter((j) => j.status === "approved" && inWeek(j.approved_at));
  const submitted = mine.filter((j) => j.status === "submitted" && inWeek(j.submitted_at));
  const inProgress = back === 0 ? mine.filter((j) => j.status === "claimed") : [];
  const jobPay = approved.reduce((a, j) => a + Number(j.earned_amount ?? 0), 0);

  // Photos for jobs done this week
  const photoJobs = [...approved, ...submitted];
  const pairs = photoJobs.flatMap((j) =>
    (j.proof_paths?.length ? j.proof_paths : j.proof_path ? [j.proof_path] : []).map((p) => ({ jobId: j.id, path: p })),
  );
  const photos: Record<string, string[]> = {};
  if (pairs.length) {
    const urls = await sign(pairs.map((p) => p.path));
    pairs.forEach((p, i) => {
      const url = urls[i];
      if (url) (photos[p.jobId] ??= []).push(url);
    });
  }

  // Routines
  const myRoutines = routines.filter((r) => r.kid_id === m.id);
  const checkFor = (r: Routine, d: string) => checks.find((c) => c.routine_id === r.id && c.check_date === d);
  const routineDays = days.filter((d) => myRoutines.some((r) => routineOn(r, d, tz)));
  const dueSoFar = routineDays.filter((d) => d <= today).flatMap((d) => myRoutines.filter((r) => routineOn(r, d, tz)));
  const doneSoFar = routineDays
    .filter((d) => d <= today)
    .reduce((n, d) => n + myRoutines.filter((r) => routineOn(r, d, tz) && checkFor(r, d)).length, 0);

  const weekRoutineDays = earnedDays.filter((x) => x.kid_id === m.id && x.day >= start && x.day <= end);
  const routinePay = weekRoutineDays.reduce((a, x) => a + Number(x.amount), 0);

  // Pay
  const paidThisWeek = payouts.filter((p) => p.kid_id === m.id && inWeek(p.paid_at));

  const typeLabel = hourly
    ? `Hourly · ${money(m.hourly_rate)}/hr${scheduleLabel(m) ? " · " + scheduleLabel(m) : ""}`
    : m.pay_type === "payroll"
      ? "Payroll · daily routine"
      : "Paid per job";

  return (
    <>
      <CrewHeader name={profile.display_name} isParent notifications={notifications} />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <Link href="/crew" className="text-sm font-semibold text-brand">← Dashboard</Link>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-bronze">{familyName}</p>
          <h1 className="text-3xl text-brand">{m.display_name}</h1>
          {m.position_title && <p className="text-sm text-stone-600">{m.position_title}</p>}
          <p className="mt-1 text-xs text-stone-500">
            <span className="font-mono">{m.username}</span> · {typeLabel}
          </p>
        </div>

        {/* Week switcher */}
        <nav className="flex items-center justify-between gap-2 rounded-2xl bg-white p-2 shadow-sm">
          {back < MAX_WEEKS_BACK ? (
            <Link href={`?w=${back + 1}`} className="btn-ghost px-3 py-1.5" aria-label="Previous week">‹</Link>
          ) : (
            <span className="w-10" />
          )}
          <div className="text-center">
            <p className="font-semibold">{back === 0 ? "This week" : back === 1 ? "Last week" : `${back} weeks ago`}</p>
            <p className="text-xs text-stone-500">{label}{hourly ? " · pay week" : ""}</p>
          </div>
          {back > 0 ? (
            <Link href={back === 1 ? "?" : `?w=${back - 1}`} className="btn-ghost px-3 py-1.5" aria-label="Next week">›</Link>
          ) : (
            <span className="w-10" />
          )}
        </nav>

        {/* Summary */}
        <section className="grid grid-cols-3 gap-3 text-center">
          {hourly ? (
            <>
              <Tile label="Hours" value={shiftHrs.toFixed(2)} />
              <Tile label="Shift pay" value={money(shiftPay)} highlight />
              <Tile label="Jobs done" value={String(approved.length)} />
            </>
          ) : m.pay_type === "payroll" ? (
            <>
              <Tile label="Routine" value={dueSoFar.length ? `${doneSoFar}/${dueSoFar.length}` : "—"} />
              <Tile label="Routine pay" value={money(routinePay)} highlight />
              <Tile label="Extra jobs" value={money(jobPay)} />
            </>
          ) : (
            <>
              <Tile label="Jobs done" value={String(approved.length)} highlight />
              <Tile label="Earned" value={money(jobPay)} />
              <Tile label="Waiting review" value={String(submitted.length)} />
            </>
          )}
        </section>

        {/* Routine log */}
        {myRoutines.length > 0 && (
          <section className="card">
            <h2 className="text-xl text-brand">Routine check-offs</h2>
            <ul className="mt-3 space-y-3">
              {routineDays.map((d) => {
                const due = myRoutines.filter((r) => routineOn(r, d, tz));
                const future = d > today;
                return (
                  <li key={d}>
                    <p className={`text-sm font-semibold ${d === today ? "text-brand" : ""}`}>
                      {prettyDate(d)} {d === today && <span className="pill ml-1 bg-gold/20 text-brand-dark">Today</span>}
                      {weekRoutineDays.find((x) => x.day === d) && (
                        <span className="pill ml-1 bg-brand-soft text-brand">+{money(weekRoutineDays.find((x) => x.day === d)!.amount)}</span>
                      )}
                    </p>
                    <ul className="mt-1 space-y-1">
                      {due.map((r) => {
                        const c = checkFor(r, d);
                        const late = c && localDate(tz, c.checked_at) !== d;
                        return (
                          <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="flex items-center gap-2">
                              <span
                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                                  c ? "bg-brand text-white" : future ? "bg-stone-100 text-stone-400" : "bg-rust/15 text-rust"
                                }`}
                                aria-hidden
                              >
                                {c ? "✓" : future ? "" : "✗"}
                              </span>
                              {r.title}
                            </span>
                            <span className="shrink-0 text-xs text-stone-500">
                              {c ? (late ? `checked ${prettyDate(localDate(tz, c.checked_at), { weekday: "short" })} ${t(c.checked_at)}` : t(c.checked_at)) : future ? "" : "not done"}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Shifts */}
        {(hourly || weekShifts.length > 0) && (
          <section className="card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xl text-brand">Shifts</h2>
              <Link href="/crew/team#timesheet" className="text-xs font-semibold text-brand">Fix a time →</Link>
            </div>
            {weekShifts.length === 0 ? (
              <p className="mt-2 text-sm text-stone-500">No shifts this week.</p>
            ) : (
              <ul className="mt-2 divide-y divide-stone-100 text-sm">
                {weekShifts.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium">{prettyDate(localDate(tz, s.started_at))}</span>
                      <span className="block text-xs text-stone-500">
                        {t(s.started_at)} – {s.ended_at ? t(s.ended_at) : "on the clock"}
                        {s.note ? ` · ${s.note}` : ""}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="font-semibold">{s.ended_at ? money(s.amount) : "—"}</span>
                      <span className="block text-xs text-stone-500">{s.ended_at ? `${shiftHours(s).toFixed(2)} hrs` : ""}</span>
                    </span>
                  </li>
                ))}
                <li className="flex justify-between pt-2 font-bold text-brand">
                  <span>Total · {shiftHrs.toFixed(2)} hrs</span>
                  <span>{money(shiftPay)}</span>
                </li>
              </ul>
            )}
          </section>
        )}

        {/* Jobs */}
        <section className="card space-y-4">
          <h2 className="text-xl text-brand">Jobs</h2>
          {approved.length + submitted.length + inProgress.length === 0 && (
            <p className="text-sm text-stone-500">No job activity this week.</p>
          )}
          <JobGroup title="Completed & approved" jobs={approved} photos={photos} time={time} tz={tz} when={(j) => j.approved_at} />
          <JobGroup title="Waiting for your review" jobs={submitted} photos={photos} time={time} tz={tz} when={(j) => j.submitted_at} reviewLink />
          <JobGroup title="In progress" jobs={inProgress} photos={{}} time={time} tz={tz} when={() => null} />
        </section>

        {/* Payouts */}
        {paidThisWeek.length > 0 && (
          <section className="card">
            <h2 className="text-xl text-brand">Paid this week</h2>
            <ul className="mt-2 divide-y divide-stone-100 text-sm">
              {paidThisWeek.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>{prettyDate(localDate(tz, p.paid_at))} · {p.method ?? "—"}{p.note ? ` · ${p.note}` : ""}</span>
                  <span className="font-semibold">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}

function calendarWeek(tz: string, back: number) {
  const today = localDate(tz);
  const start = addDays(today, -(isoDow(today) - 1) - 7 * back);
  const end = addDays(start, 6);
  return { start, end, label: `${prettyDate(start, { month: "short", day: "numeric" })} – ${prettyDate(end, { month: "short", day: "numeric" })}` };
}

function Tile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card ${highlight ? "bg-brand text-white" : ""}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${highlight ? "text-sand" : "text-bronze"}`}>{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

type J = Awaited<ReturnType<typeof loadCrew>>["jobs"][number];
function JobGroup({
  title,
  jobs,
  photos,
  time,
  tz,
  when,
  reviewLink,
}: {
  title: string;
  jobs: J[];
  photos: Record<string, string[]>;
  time: Awaited<ReturnType<typeof loadCrew>>["time"];
  tz: string;
  when: (j: J) => string | null;
  reviewLink?: boolean;
}) {
  if (!jobs.length) return null;
  return (
    <div>
      <p className="label">{title} ({jobs.length})</p>
      <ul className="space-y-3">
        {jobs.map((j) => {
          const w = when(j);
          const hrs = hoursForJob(time, j.id);
          return (
            <li key={j.id} className="rounded-xl border border-stone-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{j.title}</p>
                  <p className="text-xs text-stone-500">
                    {j.category} · {payLabel(j)}
                    {hrs > 0 ? ` · ${hrs.toFixed(2)} hrs` : ""}
                    {w ? ` · ${prettyDate(localDate(tz, w), { weekday: "short", month: "short", day: "numeric" })}` : ""}
                  </p>
                </div>
                {j.status === "approved" && <span className="shrink-0 font-bold text-brand">+{money(j.earned_amount)}</span>}
                {reviewLink && <Link href="/crew" className="shrink-0 text-xs font-semibold text-brand">Review →</Link>}
              </div>
              {photos[j.id]?.length ? (
                <ul className="mt-2 grid grid-cols-4 gap-1.5">
                  {photos[j.id].map((url, i) => (
                    <li key={url}>
                      <a href={url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`${j.title} photo ${i + 1}`} className="aspect-square w-full rounded-lg border object-cover" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

