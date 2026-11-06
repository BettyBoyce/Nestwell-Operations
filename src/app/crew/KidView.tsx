import { LiveTimer } from "@/components/LiveTimer";
import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/auth";
import { claimJob, clockIn, clockOut, submitJob } from "./actions";
import { hoursForJob, kidTotals, payLabel, type Job, type Payout, type TimeEntry } from "./data";

export function KidView({
  me,
  jobs,
  time,
  payouts,
}: {
  me: { id: string; display_name: string };
  jobs: Job[];
  time: TimeEntry[];
  payouts: Payout[];
}) {
  const t = kidTotals(me.id, jobs, time, payouts);
  const mine = jobs.filter((j) => j.assigned_to === me.id);
  const active = mine.filter((j) => j.status === "claimed");
  const waiting = mine.filter((j) => j.status === "submitted");
  const approved = mine.filter((j) => j.status === "approved").slice(0, 8);
  const extra = jobs.filter((j) => j.status === "open");
  const timerJob = t.activeTimer ? jobs.find((j) => j.id === t.activeTimer!.job_id) : null;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-3 gap-3">
        <Stat label="Owed to you" value={money(t.owed)} highlight />
        <Stat label="Earned total" value={money(t.earned)} />
        <Stat label="Hours this month" value={t.hoursThisMonth.toFixed(1)} />
      </section>

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

      <Section title="My jobs" empty="No jobs right now — check the extra jobs below!" count={active.length}>
        {active.map((j) => {
          const running = t.activeTimer?.job_id === j.id;
          return (
            <li key={j.id} className="card space-y-3">
              <JobHeader job={j} />
              {j.parent_note && (
                <p className="rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">Parent note: {j.parent_note}</p>
              )}
              <p className="text-xs text-stone-500">Time logged: {hoursForJob(time, j.id).toFixed(2)} hrs</p>
              <div className="flex flex-wrap gap-2">
                {running ? (
                  <form action={clockOut}><SubmitButton className="btn-ghost">Clock out</SubmitButton></form>
                ) : (
                  <form action={clockIn.bind(null, j.id)}><SubmitButton className="btn-ghost">Clock in</SubmitButton></form>
                )}
              </div>
              <form action={submitJob.bind(null, j.id)} className="space-y-2 border-t border-stone-100 pt-3">
                <label className="label" htmlFor={`proof-${j.id}`}>Proof photo (optional)</label>
                <input id={`proof-${j.id}`} name="proof" type="file" accept="image/*" capture="environment" className="block w-full text-sm" />
                <SubmitButton className="btn w-full" pendingText="Sending…">Mark done & send for review</SubmitButton>
              </form>
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
      </div>
      {job.description && <p className="mt-1 text-sm text-stone-600">{job.description}</p>}
      {job.due_date && <p className="mt-1 text-xs text-stone-500">Due {new Date(job.due_date + "T00:00").toLocaleDateString()}</p>}
    </div>
  );
}
