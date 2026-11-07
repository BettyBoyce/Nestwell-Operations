import Link from "next/link";
import { DAY_NAMES, isoDow } from "./data";

export type CalendarDay = {
  date: string; // YYYY-MM-DD
  status: "done" | "partial" | "missed" | "upcoming" | "off" | "open";
  badge?: string; // small text under the date, e.g. "1/2" or "$108"
};

/** Tappable week strip with weekday + date. Selecting a day sets ?day=YYYY-MM-DD. */
export function WeekCalendar({
  days,
  selected,
  today,
  basePath = "/crew",
}: {
  days: CalendarDay[];
  selected: string;
  today: string;
  basePath?: string;
}) {
  return (
    <nav aria-label="Choose a day" className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
      {days.map((d) => {
        const isSel = d.date === selected;
        const tone =
          d.status === "done"
            ? "bg-brand text-white border-brand"
            : d.status === "partial"
              ? "bg-gold/20 text-brand-dark border-gold/40"
              : d.status === "missed"
                ? "bg-rust/10 text-rust border-rust/20"
                : d.status === "open"
                  ? "bg-gold/30 text-brand-dark border-gold"
                  : d.status === "off"
                    ? "bg-stone-50 text-stone-400 border-stone-200"
                    : "bg-white text-stone-600 border-stone-200";
        const dayNum = Number(d.date.slice(8, 10));
        return (
          <Link
            key={d.date}
            href={`${basePath}?day=${d.date}`}
            scroll={false}
            aria-current={isSel ? "date" : undefined}
            className={`flex flex-col items-center rounded-2xl border px-1 py-2 text-center transition ${tone} ${
              isSel ? "ring-2 ring-brand ring-offset-2 ring-offset-white" : ""
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wide">{DAY_NAMES[isoDow(d.date)]}</span>
            <span className="text-xl font-bold leading-tight">{dayNum}</span>
            <span className="h-4 text-[10px] font-semibold leading-4">
              {d.status === "done" ? "✓" : d.badge ?? (d.date === today ? "Today" : "")}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
