import Link from "next/link";
import { logout } from "@/app/login/actions";
import { markAllRead } from "@/app/crew/actions";
import type { Notification } from "@/app/crew/data";

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const TeamIcon = () => (
  <svg {...iconProps}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M16 13.6c2.8.2 5 2.1 5 5.4" />
  </svg>
);
const BellIcon = () => (
  <svg {...iconProps}>
    <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
    <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
  </svg>
);
const LogoutIcon = () => (
  <svg {...iconProps}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 16l-4-4 4-4M6 12h10" />
  </svg>
);
const ExportIcon = () => (
  <svg {...iconProps}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" />
    <path d="M5 19h14" />
  </svg>
);

const navBtn =
  "flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2 text-sm font-medium hover:bg-white/10 sm:px-3";

export function CrewHeader({
  name,
  isParent,
  notifications,
}: {
  familyName?: string;
  name: string;
  isParent: boolean;
  notifications: Notification[];
}) {
  const unread = notifications.filter((n) => !n.read_at).length;
  return (
    <header className="sticky top-0 z-20 bg-brand text-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-2 px-4">
        <Link href="/crew" className="flex min-w-0 shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nest-mark.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          <span className="whitespace-nowrap font-serif text-xl leading-none">
            Nestwell <span className="text-sand">Crew</span>
          </span>
        </Link>

        <nav className="flex shrink-0 items-center">
          {isParent && (
            <>
              <Link href="/crew/team" className={navBtn} aria-label="Team & Pay">
                <TeamIcon />
                <span className="hidden sm:inline">Team & Pay</span>
              </Link>
              <a href="/crew/export" className={`${navBtn} hidden sm:flex`} aria-label="Export records">
                <ExportIcon />
                <span>Export</span>
              </a>
            </>
          )}

          <details className="relative">
            <summary className={`${navBtn} relative cursor-pointer list-none [&::-webkit-details-marker]:hidden`} aria-label="Notifications">
              <BellIcon />
              <span className="hidden sm:inline">Alerts</span>
              {unread > 0 && (
                <span className="absolute right-0.5 top-0.5 min-w-[18px] rounded-full bg-gold px-1 text-center text-[11px] font-bold leading-[18px] text-brand-dark">
                  {unread}
                </span>
              )}
            </summary>
            <div className="fixed inset-x-4 top-[4.5rem] z-30 rounded-2xl bg-white p-3 text-stone-800 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold">Notifications</p>
                {unread > 0 && (
                  <form action={markAllRead}>
                    <button className="text-xs font-semibold text-brand">Mark all read</button>
                  </form>
                )}
              </div>
              {notifications.length === 0 && <p className="text-sm text-stone-500">Nothing yet.</p>}
              <ul className="max-h-80 space-y-2 overflow-auto">
                {notifications.map((n) => (
                  <li key={n.id} className={`rounded-xl px-2 py-1.5 text-sm ${n.read_at ? "text-stone-500" : "bg-brand-soft"}`}>
                    {n.message}
                    <span className="block text-[11px] text-stone-400">{new Date(n.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </div>
          </details>

          <form action={logout}>
            <button className={navBtn} aria-label={`Log out (${name})`} title={`Log out ${name}`}>
              <LogoutIcon />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
