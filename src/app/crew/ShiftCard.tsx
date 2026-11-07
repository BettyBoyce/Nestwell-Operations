import { LiveTimer } from "@/components/LiveTimer";
import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/auth";
import { shiftClockIn, shiftClockOut } from "./actions";
import { clock, isoDow, localDate, payWeek, prettyDate, scheduleLabel, shiftHours, type Member, type Shift } from "./data";
import { WeekCalendar, type CalendarDay } from "./WeekCalendar";

/**
 * Hourly shift clock (e.g. Kyle). A calendar of this pay week's scheduled days (Sat–Fri);
 * tap a day to see it. On today's date: Clock in / Clock out. Past days show hours and pay.
 */
export function ShiftCard({
  me,
  openShift,
  shifts,
  tz,
  selectedDay,
}: {
  me: Member;
  openShift: Shift | null;
  shifts: Shift[];
  tz: string;
  selectedDay?: string;
}) {
  const today = localDate(tz);
  const week = payWeek(tz);
  const workDays = me.work_days ?? [];
  const mine = shifts.filter((s) => s.kid_id === me.id);
  const shiftsOn = (d: string) => mine.filter((s) => localDate(tz, s.started_at) === d).sort((a, b) => a.started_at.localeCompare(b.started_at));
  const t = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });

  // Days to show: scheduled days in this pay week, plus today and any day with a shift.
  const all = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(week.start + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const shown = all.filter((d) => workDays.includes(isoDow(d)) || d === today || shiftsOn(d).length > 0);

  const calendar: CalendarDay[] = shown.map((d) => {
    const list = shiftsOn(d);
    const pay = list.reduce((a, s) => a + Number(s.amount ?? 0), 0);
    if (list.some((s) => !s.ended_at)) return { date: d, status: "open", badge: "On clock" };
    if (list.length) return { date: d, status: "done", badge: `$${pay.toFixed(0)}` };
    if (d > today) return { date: d, status: workDays.includes(isoDow(d)) ? "upcoming" : "off" };
    if (d === today) return { date: d, status: workDays.includes(isoDow(d)) ? "open" : "off", badge: "Today" };
    return { date: d, status: workDays.includes(isoDow(d)) ? "missed" : "off", badge: workDays.includes(isoDow(d)) ? "No shift" : "" };
  });

  const nextScheduled = shown.find((d) => d >= today) ?? shown[shown.length - 1];
  const day = selectedDay && shown.includes(selectedDay) ? selectedDay : shown.includes(today) ? today : nextScheduled;
  const dayShifts = shiftsOn(day);
  const scheduled = workDays.includes(isoDow(day));
  const schedule = scheduleLabel(me);

  // Calendar badges use whole dollars; the totals below show exact amounts.
  return (
    <section className={`card space-y-4 ${openShift ? "border-gold" : ""}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xl text-brand">My shifts</h2>
        <span className="text-xs text-stone-500">Pay week {week.label}</span>
      </div>
      <p className="-mt-3 text-xs text-bronze">
        {schedule ? `${schedule} · ` : ""}
        {money(me.hourly_rate)}/hr · paid Fridays
      </p>

      {/* Always-visible clock-out when on the clock */}
      {openShift && day !== localDate(tz, openShift.started_at) && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-gold/15 p-3">
          <div>
            <p className="text-sm font-semibold">On the clock since {t(openShift.started_at)}</p>
            <p className="text-2xl text-brand"><LiveTimer since={openShift.started_at} /></p>
          </div>
          <form action={shiftClockOut}>
            <SubmitButton className="btn" pendingText="…">Clock out</SubmitButton>
          </form>
        </div>
      )}

      <WeekCalendar days={calendar} selected={day} today={today} />

      <div className={`rounded-2xl p-3 text-center ${day === today && openShift ? "bg-gold/15" : "bg-cream"}`}>
        <p className="font-semibold">
          {prettyDate(day, { weekday: "long", month: "long", day: "numeric" })}
          {day === today && <span className="pill ml-2 bg-gold/30 text-brand-dark">Today</span>}
        </p>
        {scheduled && me.shift_start && me.shift_end && (
          <p className="text-xs text-stone-500">Scheduled {clock(me.shift_start)}–{clock(me.shift_end)}</p>
        )}

        {/* Shifts already logged on this day */}
        {dayShifts.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">
            {dayShifts.map((s) => (
              <li key={s.id} className="flex justify-between rounded-xl bg-white px-3 py-2">
                <span>{t(s.started_at)} – {s.ended_at ? t(s.ended_at) : "now"}</span>
                <span className="font-semibold">
                  {s.ended_at ? `${shiftHours(s).toFixed(2)} hrs · ${money(s.amount)}` : "on the clock"}
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Actions */}
        {day === today ? (
          openShift ? (
            <>
              <p className="mt-3 text-sm text-stone-600">Clocked in at {t(openShift.started_at)}</p>
              <p className="my-2 text-4xl text-brand"><LiveTimer since={openShift.started_at} /></p>
              <form action={shiftClockOut}>
                <SubmitButton className="btn w-full py-4 text-lg" pendingText="Clocking out…">Clock out</SubmitButton>
              </form>
            </>
          ) : (
            <>
              <p className="mt-3 text-sm text-stone-600">
                {scheduled
                  ? dayShifts.length ? "Working again today? Clock in." : "You're scheduled today. Clock in when you arrive."
                  : "Not a scheduled day. Clock in only if a parent asked."}
              </p>
              <form action={shiftClockIn} className="mt-3">
                <SubmitButton className="btn w-full py-4 text-lg" pendingText="Clocking in…">Clock in</SubmitButton>
              </form>
            </>
          )
        ) : day > today ? (
          <p className="mt-3 text-sm text-stone-500">Upcoming. The Clock in button appears on this day.</p>
        ) : dayShifts.length === 0 ? (
          <p className="mt-3 text-sm text-stone-500">No shift recorded. If you worked, tell Betty your times so she can add them.</p>
        ) : null}
      </div>
    </section>
  );
}
