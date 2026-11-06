import Link from "next/link";
import { logout } from "@/app/login/actions";
import { markAllRead } from "@/app/crew/actions";
import type { Notification } from "@/app/crew/data";

export function CrewHeader({
  familyName,
  name,
  isParent,
  notifications,
}: {
  familyName: string;
  name: string;
  isParent: boolean;
  notifications: Notification[];
}) {
  const unread = notifications.filter((n) => !n.read_at).length;
  return (
    <header className="bg-brand text-white">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/crew" className="flex min-w-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/nest-mark.png" alt="" width={36} height={36} className="h-9 w-9 shrink-0" />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold uppercase tracking-widest text-sand">Nestwell Crew</span>
            <span className="block truncate font-serif text-lg leading-tight">{familyName}</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 text-sm">
          {isParent && (
            <>
              <Link href="/crew/team" className="rounded-lg px-2 py-1 hover:bg-white/10">Team & Pay</Link>
              <a href="/crew/export" className="hidden rounded-lg px-2 py-1 hover:bg-white/10 sm:inline">Export</a>
            </>
          )}
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg px-2 py-1 hover:bg-white/10" aria-label="Notifications">
              🔔{unread > 0 && <span className="ml-1 rounded-full bg-gold px-1.5 text-xs font-bold text-brand-dark">{unread}</span>}
            </summary>
            <div className="absolute right-0 z-10 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl bg-white p-3 text-stone-800 shadow-xl">
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
            <button className="rounded-lg px-2 py-1 hover:bg-white/10" title={`Signed in as ${name}`}>Log out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
