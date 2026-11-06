import { LiveTimer } from "@/components/LiveTimer";
import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/auth";
import { shiftClockIn, shiftClockOut } from "./actions";
import { isoDow, localDate, scheduleLabel, type Member, type Shift } from "./data";

export function ShiftCard({ me, openShift, tz }: { me: Member; openShift: Shift | null; tz: string }) {
  const today = localDate(tz);
  const scheduledToday = (me.work_days ?? []).includes(isoDow(today));
  const schedule = scheduleLabel(me);
  const since = openShift
    ? new Date(openShift.started_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
    : null;

  return (
    <section className={`card text-center ${openShift ? "border-gold bg-gold/10" : ""}`}>
      <p className="label">
        {schedule ? `Your schedule: ${schedule}` : "Shift clock"} · {money(me.hourly_rate)}/hr
      </p>
      {openShift ? (
        <>
          <p className="mt-1 text-sm text-stone-600">Clocked in at {since}</p>
          <p className="my-2 text-4xl text-brand">
            <LiveTimer since={openShift.started_at} />
          </p>
          <form action={shiftClockOut}>
            <SubmitButton className="btn w-full py-4 text-lg" pendingText="Clocking out…">
              Clock out
            </SubmitButton>
          </form>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm text-stone-600">
            {scheduledToday ? "You're scheduled today. Clock in when you arrive." : "Not a scheduled day. Clock in only if a parent asked."}
          </p>
          <form action={shiftClockIn} className="mt-3">
            <SubmitButton className="btn w-full py-4 text-lg" pendingText="Clocking in…">
              Clock in
            </SubmitButton>
          </form>
        </>
      )}
    </section>
  );
}
