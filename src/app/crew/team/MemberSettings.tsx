import { SubmitButton } from "@/components/SubmitButton";
import { money } from "@/lib/auth";
import { addRoutine, addShift, deleteShift, fixShift, removeRoutine, updatePaySetup } from "../actions";
import { DAY_NAMES, localDate, weekShifts, type Member, type Routine, type Shift } from "../data";

const DAYS = [1, 2, 3, 4, 5, 6, 7];

function DayPicker({ name, selected }: { name: string; selected: number[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {DAYS.map((d) => (
        <label key={d} className="cursor-pointer">
          <input type="checkbox" name={name} value={d} defaultChecked={selected.includes(d)} className="peer sr-only" />
          <span className="inline-block rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-semibold text-stone-600 peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">
            {DAY_NAMES[d]}
          </span>
        </label>
      ))}
    </div>
  );
}

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
const localTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

export function MemberSettings({
  member,
  routines,
  shifts,
  tz,
}: {
  member: Member;
  routines: Routine[];
  shifts: Shift[];
  tz: string;
}) {
  const type = member.pay_type ?? "per_job";
  return (
    <div className="space-y-5 pt-3">
      {/* Pay setup */}
      <form action={updatePaySetup.bind(null, member.id)} className="space-y-3 rounded-2xl bg-cream p-3">
        <p className="label">Pay setup</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor={`pt-${member.id}`}>How they&apos;re paid</label>
            <select id={`pt-${member.id}`} name="pay_type" defaultValue={type} className="input">
              <option value="per_job">Per job (approved jobs)</option>
              <option value="hourly">Hourly shifts (clock in/out)</option>
              <option value="payroll">Payroll (daily routine check-off)</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`rate-${member.id}`}>Hourly rate $ (hourly only)</label>
            <input id={`rate-${member.id}`} name="hourly_rate" type="number" min="0" step="0.25" defaultValue={member.hourly_rate ?? ""} className="input" />
          </div>
          <div>
            <label className="label" htmlFor={`dr-${member.id}`}>Daily rate $ (payroll only)</label>
            <input id={`dr-${member.id}`} name="daily_rate" type="number" min="0" step="0.01" defaultValue={member.daily_rate ?? ""} className="input" />
            <p className="mt-1 text-[11px] text-stone-500">Earned each day all routine tasks are checked off. Monthly pay ÷ 20.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor={`title-${member.id}`}>Position title</label>
            <input id={`title-${member.id}`} name="position_title" defaultValue={member.position_title ?? ""} className="input" placeholder="e.g. Maintenance & Finance Lead" />
          </div>
          <div className="sm:col-span-2">
            <p className="label">Scheduled days (hourly only)</p>
            <DayPicker name="work_days" selected={member.work_days ?? []} />
          </div>
          <div>
            <label className="label" htmlFor={`ss-${member.id}`}>Shift start</label>
            <input id={`ss-${member.id}`} name="shift_start" type="time" defaultValue={hhmm(member.shift_start)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor={`se-${member.id}`}>Shift end</label>
            <input id={`se-${member.id}`} name="shift_end" type="time" defaultValue={hhmm(member.shift_end)} className="input" />
          </div>
        </div>
        <SubmitButton className="btn w-full">Save pay setup</SubmitButton>
      </form>

      {/* Routines (payroll) */}
      {type === "payroll" && (
        <div className="space-y-3">
          <p className="label">Daily routine</p>
          {routines.length === 0 && <p className="text-sm text-stone-500">No routine tasks yet.</p>}
          <ul className="space-y-2">
            {routines.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-stone-200 px-3 py-2 text-sm">
                <span>
                  <span className="font-medium">{r.title}</span>
                  <span className="block text-xs text-stone-500">{r.days.slice().sort().map((d) => DAY_NAMES[d]).join(", ")}</span>
                </span>
                <form action={removeRoutine.bind(null, r.id)}>
                  <button className="text-xs font-semibold text-rust hover:underline">Remove</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addRoutine.bind(null, member.id)} className="space-y-2 rounded-2xl border border-dashed border-sand p-3">
            <input name="title" className="input" placeholder="Add a routine task, e.g. Take out recycling" required />
            <DayPicker name="days" selected={[1, 2, 3, 4, 5]} />
            <SubmitButton className="btn-ghost w-full">Add routine task</SubmitButton>
          </form>
        </div>
      )}

      {/* Timesheet (hourly) */}
      {type === "hourly" && <Timesheet member={member} shifts={shifts} tz={tz} />}
    </div>
  );
}

function Timesheet({ member, shifts, tz }: { member: Member; shifts: Shift[]; tz: string }) {
  const weeks = [0, 1].map((o) => weekShifts(shifts, member.id, tz, o));
  return (
    <div id="timesheet" className="space-y-4">
      {weeks.map((w, i) => (
        <div key={w.start}>
          <div className="flex items-baseline justify-between">
            <p className="label mb-0">{i === 0 ? "This pay week" : "Last pay week"} · {w.label}</p>
            <span className="text-sm font-bold text-brand">{w.hours.toFixed(2)} h · {money(w.amount)}</span>
          </div>
          {w.list.length === 0 ? (
            <p className="mt-1 text-sm text-stone-500">No shifts.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {w.list.map((s) => (
                <li key={s.id} className="rounded-xl border border-stone-200 p-2">
                  <form action={fixShift.bind(null, s.id, tz)} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="label">Date</label>
                      <input name="date" type="date" defaultValue={localDate(tz, s.started_at)} className="input" />
                    </div>
                    <div>
                      <label className="label">In</label>
                      <input name="start" type="time" defaultValue={localTime(s.started_at, tz)} className="input" />
                    </div>
                    <div>
                      <label className="label">Out</label>
                      <input name="end" type="time" defaultValue={s.ended_at ? localTime(s.ended_at, tz) : ""} className="input" />
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:flex-col sm:items-end">
                      <span className="text-sm font-semibold">{s.ended_at ? money(s.amount) : "On clock"}</span>
                      <SubmitButton className="btn-ghost px-3 py-1 text-xs" pendingText="…">Save</SubmitButton>
                    </div>
                    <input name="note" defaultValue={s.note ?? ""} placeholder="Note (optional)" className="input col-span-2 sm:col-span-4" />
                  </form>
                  <form action={deleteShift.bind(null, s.id)} className="mt-1 text-right">
                    <button className="text-xs font-semibold text-rust hover:underline">Delete shift</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
      <form action={addShift.bind(null, member.id, tz)} className="space-y-2 rounded-2xl border border-dashed border-sand p-3">
        <p className="label mb-0">Add a missed shift</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Date</label>
            <input name="date" type="date" defaultValue={localDate(tz)} className="input" required />
          </div>
          <div>
            <label className="label">In</label>
            <input name="start" type="time" defaultValue={member.shift_start?.slice(0, 5) ?? ""} className="input" required />
          </div>
          <div>
            <label className="label">Out</label>
            <input name="end" type="time" defaultValue={member.shift_end?.slice(0, 5) ?? ""} className="input" required />
          </div>
        </div>
        <input name="note" placeholder="Note, e.g. Forgot to clock in" className="input" />
        <SubmitButton className="btn-ghost w-full">Add shift</SubmitButton>
      </form>
      <p className="text-xs text-stone-500">Pay weeks run Saturday to Friday, so Friday&apos;s shift is included in that Friday&apos;s pay. Times are Pacific.</p>
    </div>
  );
}
