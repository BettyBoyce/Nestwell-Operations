import { LiveTimer } from "@/components/LiveTimer";
import { PhotoSubmit } from "@/components/PhotoSubmit";
import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/auth";
import { claimJob, clockIn, clockOut, submitJob } from "./actions";
import {
  hoursForJob,
  kidTotals,
  payLabel,
  weekShifts,
  type Job,
  type Member,
  type Payout,
  type Routine,
  type RoutineCheck,
  type Shift,
  type TimeEntry,
} from "./data";
import { RoutineCard } from "./RoutineCard";
import { ShiftCard } from "./ShiftCard";

export function KidView({
  me,
  jobs,
  time,
  payouts,
  shifts = [],
  routines = [],
  checks = [],
  tz = "America/Los_Angeles",
  selectedDay,
}: {
  me: Member;
  jobs: Job[];
  time: TimeEntry[];
  payouts: Payout[];
  shifts?: Shift[];
  routines?: Routine[];
  checks?: RoutineCheck[];
  tz?: string;
  selectedDay?: string;
}) {
  const t = kidTotals(me.id, jobs, time, payouts, shifts, me.pay_type);
  const hourly = me.pay_type === "hourly";
  const payroll = me.pay_type === "payroll";
  const week = weekShifts(shifts, me.id, tz);
  const mine = jobs.filter((j) => j.assigned_to === me.id);
  const active = mine.filter((j) => j.status === "claimed");
  const waiting = mine.filter((j) => j.status === "submitted");
  const approved = mine.filter((j) => j.status === "approved").slice(0, 8);
  const extra = jobs.filter((j) => j.status === "open");
  const timerJob = t.activeTimer ? jobs.find((j) => j.id === t.activeTimer!.job_id) : null;

  return (
    <div className="space-y-6">
      {hourly ? (
        <>
          <ShiftCard me={me} openShift={t.openShift} shifts={shifts} tz={tz} selectedDay={selectedDay} />
          <section className="grid grid-cols-3 gap-3">
            <Stat label="This week" value={money(week.amount)} highlight />
            <Stat label="Hours this week" value={week.hours.toFixed(2)} />
            <Stat label="Owed to you" value={money(t.owed)} />
          </section>
          <WeekShiftList week={week} tz={tz} />
        </>
      ) : payroll ? (
        <RoutineCard me={me} routines={routines.filter((r) => r.kid_id === me.id)} checks={checks} tz={tz} selectedDay={selectedDay} />
      ) : (
        <section className="grid grid-cols-3 gap-3">
          <Stat label="Owed to you" value={money(t.owed)} highlight />
          <Stat label="Earned total" value={money(t.earned)} />
          <Stat label="Hours this month" value={t.hoursThisMonth.toFixed(1)} />
        </section>
      )}

      {payroll && (t.earned > 0 || mine.length > 0) && (
        <section className="grid grid-cols-2 gap-3">
          <Stat label="Extra jobs owed" value={money(t.owed)} highlight />
          <Stat label="Extra jobs earned" value={money(t.earned)} />
        </section>
      )}

      {t.activeTimer && (
        <section className="card flex items-center justify-between gap-3 border-gold bg-gold/10">
          <div>
            <p className="label">On the clock</p>
            <p className="font-semibold">{timerJob?.title ?? "Job"}</p>
            <p className="text-2xl text-brand"><LiveTimer since={t.activeTimer.started_at} /></p>
          </div>
          <form action={clockOut}>
            <SubmitButton className="btn">Clock out</SubmitButton>
          </form>
        </section>
      )}

      <Section title="My jobs" empty={hourly || payroll ? "No extra jobs assigned right now." : "No jobs right now — check the extra jobs below!"} count={active.length}>
        {active.map((j) => {
          const running = t.activeTimer?.job_id === j.id;
          return (
            <li key={j.id} className="card space-y-3">
              <JobHeader job={j} />
              {j.parent_note && (
                <p className="rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">Parent note: {j.parent_note}</p>
              )}
              <ol className="flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-bronze">
                <li>① Clock in</li><li>② Do the work</li><li>③ Take photos</li><li>④ Send for review</li>
              </ol>
              <p className="text-xs text-stone-500">Time logged: {hoursForJob(time, j.id).toFixed(2)} hrs</p>
              <div className="flex flex-wrap gap-2">
                {running ? (
                  <form action={clockOut}><SubmitButton className="btn-ghost">Clock out</SubmitButton></form>
                ) : (
                  <form action={clockIn.bind(null, j.id)}><SubmitButton className="btn-ghost">Clock in</SubmitButton></form>
                )}
              </div>
              <PhotoSubmit action={submitJob.bind(null, j.id)} required={j.photo_required !== false} />
            </li>
          );
        })}
      </Section>

      {waiting.length > 0 && (
        <Section title="Waiting for approval" count={waiting.length}>
          {waiting.map((j) => (
            <li key={j.id} className="card"><JobHeader job={j} /><p className="mt-1 text-xs text-bronze">Sent for review ✓</p></li>
          ))}
        </Section>
      )}

      <Section title="Extra jobs — earn more" empty="No extra jobs posted yet." count={extra.length}>
        {extra.length > 0 && (
          <li className="text-xs text-stone-500">Tap <b>Claim</b> and the job moves to <b>My jobs</b>, where you clock in, take photos and send it for review.</li>
        )}
        {extra.map((j) => (
          <li key={j.id} className="card flex items-start justify-between gap-3">
            <JobHeader job={j} />
            <form action={claimJob.bind(null, j.id)}>
              <SubmitButton className="btn-gold" pendingText="Claiming…">Claim</SubmitButton>
            </form>
          </li>
        ))}
      </Section>

      {approved.length > 0 && (
        <Section title="Recently approved" count={approved.length}>
          {approved.map((j) => (
            <li key={j.id} className="card flex items-center justify-between">
              <span className="font-medium">{j.title}</span>
              <span className="font-bold text-brand">+{money(j.earned_amount)}</span>
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}

export function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`card text-center ${highlight ? "bg-brand text-white" : ""}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-wide ${highlight ? "text-sand" : "text-bronze"}`}>{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

export function Section({ title, count, empty, children }: { title: string; count: number; empty?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xl text-brand">{title} <span className="font-sans text-sm text-stone-400">({count})</span></h2>
      {count === 0 && empty ? <p className="card text-sm text-stone-500">{empty}</p> : <ul className="space-y-3">{children}</ul>}
    </section>
  );
}

export function JobHeader({ job }: { job: Job }) {
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{job.title}</p>
        <span className="pill bg-gold/20 text-brand-dark">{payLabel(job)}</span>
        <span className="pill bg-brand-soft text-brand">{job.category}</span>
        {job.photo_required !== false && <span className="pill bg-copper/15 text-copper">📸 Photo required</span>}
      </div>
      {job.description && <p className="mt-1 text-sm text-stone-600">{job.description}</p>}
      {job.due_date && <p className="mt-1 text-xs text-stone-500">Due {new Date(job.due_date + "T00:00").toLocaleDateString()}</p>}
    </div>
  );
}

function WeekShiftList({ week, tz }: { week: ReturnType<typeof weekShifts>; tz: string }) {
  const fmt = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: tz });
  return (
    <section className="card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl text-brand">This pay week</h2>
        <span className="text-xs text-stone-500">{week.label} · paid Friday</span>
      </div>
      {week.list.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500">No shifts yet this week.</p>
      ) : (
        <ul className="mt-2 divide-y divide-stone-100 text-sm">
          {week.list.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span>
                <span className="font-medium">{day(s.started_at)}</span>
                <span className="block text-xs text-stone-500">
                  {fmt(s.started_at)} – {s.ended_at ? fmt(s.ended_at) : "on the clock"}
                  {s.note ? ` · ${s.note}` : ""}
                </span>
              </span>
              <span className="text-right">
                <span className="font-semibold">{s.ended_at ? money(s.amount) : "—"}</span>
                <span className="block text-xs text-stone-500">
                  {s.ended_at ? `${((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 3_600_000).toFixed(2)} hrs` : ""}
                </span>
              </span>
            </li>
          ))}
          <li className="flex justify-between pt-2 font-bold text-brand">
            <span>Week total · {week.hours.toFixed(2)} hrs</span>
            <span>{money(week.amount)}</span>
          </li>
        </ul>
      )}
    </section>
  );
}
