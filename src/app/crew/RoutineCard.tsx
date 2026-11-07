import { toggleRoutine } from "./actions";
import { money } from "@/lib/auth";
import { addDays, isoDow, localDate, prettyDate, type Member, type Routine, type RoutineCheck, type RoutineDay } from "./data";
import { WeekCalendar, type CalendarDay } from "./WeekCalendar";

/**
 * Daily routine check-off (payroll crew).
 * A Monday–Friday calendar with dates; tap a day to open that day's routine and mark tasks complete.
 */
export function RoutineCard({
  me,
  routines,
  checks,
  routineDays = [],
  tz,
  selectedDay,
}: {
  me: Member;
  routines: Routine[];
  checks: RoutineCheck[];
  routineDays?: RoutineDay[];
  tz: string;
  selectedDay?: string;
}) {
  const today = localDate(tz);
  const dow = isoDow(today);
  // On Sat/Sun show the coming week so the calendar is always useful.
  const monday = dow >= 6 ? addDays(today, 8 - dow) : addDays(today, 1 - dow);
  const weekdays = [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
  const thisMonday = addDays(today, 1 - dow);
  const earliest = thisMonday; // crew can catch up within the current week

  const dueOn = (d: string) => routines.filter((r) => r.days.includes(isoDow(d)));
  const isDone = (r: Routine, d: string) => checks.some((c) => c.routine_id === r.id && c.check_date === d);
  const rate = Number(me.daily_rate ?? 0);
  const earnedOn = (d: string) => routineDays.find((x) => x.kid_id === me.id && x.day === d);

  const calendar: CalendarDay[] = weekdays.map((d) => {
    const due = dueOn(d);
    const n = due.filter((r) => isDone(r, d)).length;
    if (!due.length) return { date: d, status: "off", badge: "Off" };
    if (d > today) return { date: d, status: "upcoming" };
    if (n === due.length) return { date: d, status: "done", badge: earnedOn(d) ? `+${money(earnedOn(d)!.amount)}` : undefined };
    if (n > 0) return { date: d, status: "partial", badge: `${n}/${due.length}` };
    return { date: d, status: d === today ? "open" : "missed", badge: d === today ? "Today" : `0/${due.length}` };
  });

  const fallback = weekdays.includes(today) ? today : weekdays[0];
  const day = selectedDay && weekdays.includes(selectedDay) ? selectedDay : fallback;
  const due = dueOn(day);
  const doneCount = due.filter((r) => isDone(r, day)).length;
  const future = day > today;
  const tooOld = day < earliest;
  const canCheck = !future && !tooOld;

  return (
    <section className="card space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl text-brand">My routine</h2>
        <span className="text-xs text-stone-500">
          Week of {prettyDate(weekdays[0], { month: "short", day: "numeric" })}
        </span>
      </div>
      {rate > 0 && (
        <p className="-mt-3 text-xs text-bronze">Finish every task on a day to earn {money(rate)} for that day.</p>
      )}

      {routines.length === 0 ? (
        <p className="text-sm text-stone-500">No routine set up yet. Ask a parent to add yours.</p>
      ) : (
        <>
          <WeekCalendar days={calendar} selected={day} today={today} />

          <div className="rounded-2xl bg-cream p-3">
            <p className="mb-2 font-semibold">
              {prettyDate(day, { weekday: "long", month: "long", day: "numeric" })}
              {day === today && <span className="pill ml-2 bg-gold/30 text-brand-dark">Today</span>}
            </p>

            {due.length === 0 ? (
              <p className="text-sm text-stone-500">No routine on this day. 🌿</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {due.map((r) => {
                    const done = isDone(r, day);
                    const body = (
                      <>
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-lg font-bold ${
                            done ? "border-white bg-white text-brand" : "border-stone-300 bg-white"
                          }`}
                          aria-hidden
                        >
                          {done ? "✓" : ""}
                        </span>
                        <span className="font-semibold">{r.title}</span>
                      </>
                    );
                    const cls = `flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left transition ${
                      done ? "border-brand bg-brand text-white" : "border-sand bg-white"
                    }`;
                    return (
                      <li key={r.id}>
                        {canCheck ? (
                          <form action={toggleRoutine.bind(null, r.id, day)}>
                            <button className={`${cls} ${done ? "" : "hover:border-brand"}`} aria-pressed={done}>
                              {body}
                            </button>
                          </form>
                        ) : (
                          <div className={`${cls} opacity-60`}>{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
                <p className={`mt-3 text-center text-sm font-semibold ${doneCount === due.length ? "text-brand" : "text-stone-500"}`}>
                  {future
                    ? "Upcoming. You can check these off on the day."
                    : tooOld
                      ? "This day is in a past week. Ask a parent if something is missing."
                      : doneCount === due.length
                        ? earnedOn(day)
                          ? `All done. You earned ${money(earnedOn(day)!.amount)} for this day! ✓`
                          : "All done for this day. Nice work! ✓"
                        : `${doneCount} of ${due.length} done. Tap each task when it's finished.`}
                </p>
              </>
            )}
          </div>
          {me.position_title && <p className="text-center text-xs text-bronze">{me.position_title}</p>}
        </>
      )}
    </section>
  );
}
