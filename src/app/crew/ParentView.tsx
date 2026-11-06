import Link from "next/link";
import { LiveTimer } from "@/components/LiveTimer";
import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/auth";
import { approveJob, createJob, deleteJob, payBalance, sendBackJob } from "./actions";
import {
  DAY_NAMES,
  hoursForJob,
  isoDow,
  JOB_CATEGORIES,
  kidTotals,
  PAY_METHODS,
  routineWeek,
  scheduleLabel,
  weekShifts,
  type Job,
  type Member,
  type Payout,
  type Routine,
  type RoutineCheck,
  type Shift,
  type TimeEntry,
} from "./data";
import { JobHeader, Section } from "./KidView";

export function ParentView({
  members,
  jobs,
  time,
  payouts,
  proofUrls,
  shifts = [],
  routines = [],
  checks = [],
  tz = "America/Los_Angeles",
}: {
  members: Member[];
  jobs: Job[];
  time: TimeEntry[];
  payouts: Payout[];
  proofUrls: Record<string, string[]>;
  shifts?: Shift[];
  routines?: Routine[];
  checks?: RoutineCheck[];
  tz?: string;
}) {
  const rweek = routineWeek(tz);
  const kids = members.filter((m) => m.role === "kid");
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.display_name ?? "Unassigned";
  const review = jobs.filter((j) => j.status === "submitted");
  const inProgress = jobs.filter((j) => j.status === "claimed" || j.status === "open");

  return (
    <div className="space-y-6">
      {kids.length === 0 && (
        <div className="card border-gold bg-gold/10">
          <p className="font-semibold">Start by adding your crew.</p>
          <p className="text-sm text-stone-600">Each crew member gets a username and password to log in on their phone.</p>
          <Link href="/crew/team" className="btn mt-3">Add crew members</Link>
        </div>
      )}

      {kids.length > 0 && (
        <section className="grid gap-3 sm:grid-cols-2">
          {kids.map((k) => {
            const t = kidTotals(k.id, jobs, time, payouts, shifts);
            const header = (
              <div className="flex items-start justify-between gap-2">
                <Link href={`/crew/member/${k.id}`} className="group min-w-0">
                  <p className="font-serif text-lg leading-tight group-hover:underline">
                    {k.display_name} <span className="font-sans text-sm text-stone-400">›</span>
                  </p>
                  {k.position_title && <p className="truncate text-xs text-stone-500">{k.position_title}</p>}
                </Link>
                {(t.openShift || t.activeTimer) && (
                  <span className="pill shrink-0 bg-gold/20 text-brand-dark">
                    ⏱ <LiveTimer since={(t.openShift ?? t.activeTimer)!.started_at} />
                  </span>
                )}
              </div>
            );

            if (k.pay_type === "hourly") {
              const w = weekShifts(shifts, k.id, tz);
              return (
                <div key={k.id} className="card space-y-3">
                  {header}
                  <p className="text-xs text-bronze">
                    Hourly · ${Number(k.hourly_rate ?? 0).toFixed(2)}/hr{scheduleLabel(k) ? ` · ${scheduleLabel(k)}` : ""}
                  </p>
                  <dl className="grid grid-cols-3 text-center text-sm">
                    <div><dt className="text-[11px] uppercase text-bronze">This week</dt><dd className="font-bold">{w.hours.toFixed(2)} h</dd></div>
                    <div><dt className="text-[11px] uppercase text-bronze">Week pay</dt><dd className="font-bold">{money(w.amount)}</dd></div>
                    <div><dt className="text-[11px] uppercase text-bronze">Owed</dt><dd className="font-bold text-brand">{money(t.owed)}</dd></div>
                  </dl>
                  {t.owed > 0 && (
                    <form action={payBalance.bind(null, k.id, t.owed, `Week of ${w.label}`)} className="flex gap-2">
                      <select name="method" className="input w-auto" aria-label="Payment method">
                        {PAY_METHODS.map((m) => <option key={m}>{m}</option>)}
                      </select>
                      <SubmitButton className="btn-gold flex-1" pendingText="Saving…">Mark {money(t.owed)} paid</SubmitButton>
                    </form>
                  )}
                  <div className="flex justify-between text-xs font-semibold text-brand">
                    <Link href={`/crew/member/${k.id}`}>See this week →</Link>
                    <Link href="/crew/team#timesheet">Fix timesheet →</Link>
                  </div>
                </div>
              );
            }

            if (k.pay_type === "payroll") {
              const mine = routines.filter((r) => r.kid_id === k.id);
              const isDone = (r: Routine, d: string) => checks.some((c) => c.routine_id === r.id && c.check_date === d);
              const workDays = rweek.days.filter((d) => mine.some((r) => r.days.includes(isoDow(d))));
              const dueToday = mine.filter((r) => r.days.includes(isoDow(rweek.today)));
              const doneToday = dueToday.filter((r) => isDone(r, rweek.today)).length;
              return (
                <div key={k.id} className="card space-y-3">
                  {header}
                  <p className="text-xs text-bronze">Payroll · daily routine</p>
                  {mine.length === 0 ? (
                    <p className="text-sm text-stone-500">No routine set. <Link className="font-semibold text-brand" href="/crew/team">Add one</Link></p>
                  ) : (
                    <>
                      <p className={`text-sm font-semibold ${dueToday.length && doneToday === dueToday.length ? "text-brand" : "text-stone-600"}`}>
                        Today: {dueToday.length === 0 ? "nothing scheduled" : doneToday === dueToday.length ? "all done ✓" : `${doneToday} of ${dueToday.length} done`}
                      </p>
                      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.max(workDays.length, 1)}, minmax(0, 1fr))` }}>
                        {workDays.map((d) => {
                          const due = mine.filter((r) => r.days.includes(isoDow(d)));
                          const n = due.filter((r) => isDone(r, d)).length;
                          const future = d > rweek.today;
                          return (
                            <div
                              key={d}
                              title={due.map((r) => `${isDone(r, d) ? "✓" : "✗"} ${r.title}`).join("\n")}
                              className={`rounded-lg py-1 text-center text-[11px] ${d === rweek.today ? "ring-2 ring-gold" : ""} ${
                                future ? "bg-stone-50 text-stone-400" : n === due.length ? "bg-brand text-white" : n ? "bg-gold/20" : "bg-rust/10 text-rust"
                              }`}
                            >
                              <span className="block font-semibold">{DAY_NAMES[isoDow(d)]}</span>
                              {future ? "·" : n === due.length ? "✓" : `${n}/${due.length}`}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                  {t.owed > 0 && <p className="text-xs text-stone-500">Extra jobs owed: <b className="text-brand">{money(t.owed)}</b></p>}
                  <Link href={`/crew/member/${k.id}`} className="block text-center text-xs font-semibold text-brand">See this week →</Link>
                </div>
              );
            }

            return (
              <div key={k.id} className="card">
                {header}
                <dl className="mt-2 grid grid-cols-3 text-center text-sm">
                  <div><dt className="text-[11px] uppercase text-bronze">Owed</dt><dd className="font-bold text-brand">{money(t.owed)}</dd></div>
                  <div><dt className="text-[11px] uppercase text-bronze">Earned</dt><dd className="font-bold">{money(t.earned)}</dd></div>
                  <div><dt className="text-[11px] uppercase text-bronze">Hrs/mo</dt><dd className="font-bold">{t.hoursThisMonth.toFixed(1)}</dd></div>
                </dl>
                <div className="mt-3"><Link href={`/crew/member/${k.id}`} className="block text-center text-xs font-semibold text-brand">See this week →</Link></div>
              </div>
            );
          })}
        </section>
      )}

      <Section title="Needs your review" empty="Nothing waiting. 🎉" count={review.length}>
        {review.map((j) => (
          <li key={j.id} className="card space-y-3">
            <JobHeader job={j} />
            <p className="text-sm">
              <span className="font-semibold">{nameOf(j.assigned_to)}</span> · {hoursForJob(time, j.id).toFixed(2)} hrs logged
            </p>
            {proofUrls[j.id]?.length ? (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {proofUrls[j.id].map((url, i) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Work photo ${i + 1}`} className="aspect-square w-full rounded-xl border object-cover" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-500">No photos submitted.</p>
            )}
            <p className="text-xs text-stone-500">Tap a photo to see it full size.</p>
            <div className="flex flex-wrap items-end gap-2">
              <form action={approveJob.bind(null, j.id)}>
                <SubmitButton pendingText="Approving…">Approve</SubmitButton>
              </form>
              <form action={sendBackJob.bind(null, j.id)} className="flex flex-1 gap-2">
                <input name="note" className="input" placeholder="What needs fixing?" />
                <SubmitButton className="btn-ghost">Send back</SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </Section>

      <section className="card">
        <h2 className="text-xl text-brand">Post a job</h2>
        <form action={createJob} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="title">Job</label>
            <input id="title" name="title" className="input" placeholder="Restock coffee & toiletries at Unit B" required />
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="description">Details</label>
            <textarea id="description" name="description" className="input" rows={2} placeholder="What does 'done' look like?" />
          </div>
          <div>
            <label className="label" htmlFor="category">Category</label>
            <select id="category" name="category" className="input">
              {JOB_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="assigned_to">Who</label>
            <select id="assigned_to" name="assigned_to" className="input">
              <option value="">Anyone — post as extra job</option>
              {kids.map((k) => <option key={k.id} value={k.id}>{k.display_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="pay_type">Pay</label>
              <select id="pay_type" name="pay_type" className="input">
                <option value="flat">Flat</option>
                <option value="hourly">Hourly</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="pay_amount">Amount $</label>
              <input id="pay_amount" name="pay_amount" type="number" min="0" step="0.25" className="input" required />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="due_date">Due date</label>
            <input id="due_date" name="due_date" type="date" className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm text-stone-600 sm:col-span-2">
            <input type="checkbox" name="photo_optional" className="h-4 w-4 accent-brand" />
            No photo needed for this job <span className="text-xs text-stone-400">(photos are required by default)</span>
          </label>
          <div className="sm:col-span-2">
            <SubmitButton className="btn w-full" pendingText="Posting…">Post job & notify</SubmitButton>
          </div>
        </form>
      </section>

      <Section title="Open & in progress" empty="No active jobs." count={inProgress.length}>
        {inProgress.map((j) => (
          <li key={j.id} className="card flex items-start justify-between gap-3">
            <div className="min-w-0">
              <JobHeader job={j} />
              <p className="mt-1 text-xs text-stone-500">
                {j.status === "open" ? "Open extra job" : `Assigned to ${nameOf(j.assigned_to)}`}
              </p>
            </div>
            <form action={deleteJob.bind(null, j.id)}>
              <button className="text-xs font-semibold text-rust hover:underline">Remove</button>
            </form>
          </li>
        ))}
      </Section>
    </div>
  );
}
