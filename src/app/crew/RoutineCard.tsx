import { toggleRoutine } from "./actions";
import { DAY_NAMES, isoDow, prettyDate, routineWeek, type Member, type Routine, type RoutineCheck } from "./data";

/** Daily routine check-off (payroll crew). Big tap targets for today; the week at a glance below. */
export function RoutineCard({
  me,
  routines,
  checks,
  tz,
}: {
  me: Member;
  routines: Routine[];
  checks: RoutineCheck[];
  tz: string;
}) {
  const { today, days } = routineWeek(tz);
  const isDone = (r: Routine, d: string) => checks.some((c) => c.routine_id === r.id && c.check_date === d);
  const dueToday = routines.filter((r) => r.days.includes(isoDow(today)));
  const doneToday = dueToday.filter((r) => isDone(r, today)).length;
  const workDays = days.filter((d) => routines.some((r) => r.days.includes(isoDow(d))));
  const missed = workDays.filter((d) => d < today).flatMap((d) =>
    routines.filter((r) => r.days.includes(isoDow(d)) && !isDone(r, d)).map((r) => ({ r, d })),
  );

  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl text-brand">Today&apos;s routine</h2>
        <span className="text-xs text-stone-500">{prettyDate(today)}</span>
      </div>
      {me.position_title && <p className="-mt-3 text-xs text-bronze">{me.position_title}</p>}

      {routines.length === 0 ? (
        <p className="text-sm text-stone-500">No routine set up yet. Ask a parent to add yours.</p>
      ) : dueToday.length === 0 ? (
        <p className="rounded-xl bg-brand-soft px-3 py-3 text-sm text-brand">No routine today. Enjoy your day off! 🌿</p>
      ) : (
        <>
          <ul className="space-y-2">
            {dueToday.map((r) => {
              const done = isDone(r, today);
              return (
                <li key={r.id}>
                  <form action={toggleRoutine.bind(null, r.id, today)}>
                    <button
                      className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition ${
                        done ? "border-brand bg-brand text-white" : "border-sand bg-white hover:border-brand"
                      }`}
                      aria-pressed={done}
                    >
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
                          done ? "border-white bg-white text-brand" : "border-stone-300"
                        }`}
                        aria-hidden
                      >
                        {done ? "✓" : ""}
                      </span>
                      <span className="font-semibold">{r.title}</span>
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
          <p className={`text-center text-sm font-semibold ${doneToday === dueToday.length ? "text-brand" : "text-stone-500"}`}>
            {doneToday === dueToday.length ? "All done for today. Nice work! ✓" : `${doneToday} of ${dueToday.length} done — tap each one when finished`}
          </p>
        </>
      )}

      {routines.length > 0 && workDays.length > 0 && (
        <div className="border-t border-stone-100 pt-3">
          <p className="label">This week</p>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${workDays.length}, minmax(0, 1fr))` }}>
            {workDays.map((d) => {
              const due = routines.filter((r) => r.days.includes(isoDow(d)));
              const n = due.filter((r) => isDone(r, d)).length;
              const full = n === due.length;
              const future = d > today;
              return (
                <div
                  key={d}
                  className={`rounded-xl py-2 text-center text-xs ${
                    d === today ? "ring-2 ring-gold" : ""
                  } ${future ? "bg-stone-50 text-stone-400" : full ? "bg-brand text-white" : n ? "bg-gold/20 text-brand-dark" : "bg-rust/10 text-rust"}`}
                >
                  <span className="block font-semibold">{DAY_NAMES[isoDow(d)]}</span>
                  <span className="block text-base leading-tight">{future ? "·" : full ? "✓" : `${n}/${due.length}`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {missed.length > 0 && (
        <details className="rounded-xl bg-rust/5 px-3 py-2 text-sm">
          <summary className="cursor-pointer font-semibold text-rust">Forgot to check something earlier this week? ({missed.length})</summary>
          <ul className="mt-2 space-y-2">
            {missed.map(({ r, d }) => (
              <li key={r.id + d} className="flex items-center justify-between gap-2">
                <span>
                  {prettyDate(d, { weekday: "short" })} · {r.title}
                </span>
                <form action={toggleRoutine.bind(null, r.id, d)}>
                  <button className="btn-ghost px-3 py-1 text-xs">I did it</button>
                </form>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
