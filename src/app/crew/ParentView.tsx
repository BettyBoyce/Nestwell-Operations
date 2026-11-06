import Link from "next/link";
import { LiveTimer } from "@/components/LiveTimer";
import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/auth";
import { approveJob, createJob, deleteJob, sendBackJob } from "./actions";
import { hoursForJob, JOB_CATEGORIES, kidTotals, type Job, type Member, type Payout, type TimeEntry } from "./data";
import { JobHeader, Section } from "./KidView";

export function ParentView({
  members,
  jobs,
  time,
  payouts,
  proofUrls,
}: {
  members: Member[];
  jobs: Job[];
  time: TimeEntry[];
  payouts: Payout[];
  proofUrls: Record<string, string[]>;
}) {
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
            const t = kidTotals(k.id, jobs, time, payouts);
            return (
              <div key={k.id} className="card">
                <div className="flex items-center justify-between">
                  <p className="font-serif text-lg">{k.display_name}</p>
                  {t.activeTimer && (
                    <span className="pill bg-gold/20 text-brand-dark">⏱ <LiveTimer since={t.activeTimer.started_at} /></span>
                  )}
                </div>
                <dl className="mt-2 grid grid-cols-3 text-center text-sm">
                  <div><dt className="text-[11px] uppercase text-bronze">Owed</dt><dd className="font-bold text-brand">{money(t.owed)}</dd></div>
                  <div><dt className="text-[11px] uppercase text-bronze">Earned</dt><dd className="font-bold">{money(t.earned)}</dd></div>
                  <div><dt className="text-[11px] uppercase text-bronze">Hrs/mo</dt><dd className="font-bold">{t.hoursThisMonth.toFixed(1)}</dd></div>
                </dl>
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
