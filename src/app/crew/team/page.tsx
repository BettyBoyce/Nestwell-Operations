import { CrewHeader } from "@/components/CrewHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { money, requireParent } from "@/lib/auth";
import { addKid, recordPayout } from "../actions";
import { kidTotals, loadCrew } from "../data";

export const dynamic = "force-dynamic";

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireParent();
  const { error } = await searchParams;
  const { profile, familyName, members, jobs, time, payouts, notifications } = await loadCrew();
  const kids = members.filter((m) => m.role === "kid");
  const nameOf = (id: string) => members.find((m) => m.id === id)?.display_name ?? "—";

  return (
    <>
      <CrewHeader familyName={familyName} name={profile.display_name} isParent notifications={notifications} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <h1 className="text-3xl text-brand">Team & Pay</h1>
        {error && <p className="rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p>}

        <section className="card">
          <h2 className="text-xl text-brand">The crew</h2>
          {kids.length === 0 && <p className="mt-2 text-sm text-stone-500">No kids added yet.</p>}
          <ul className="mt-3 divide-y divide-stone-100">
            {kids.map((k) => {
              const t = kidTotals(k.id, jobs, time, payouts);
              return (
                <li key={k.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-semibold">{k.display_name}</p>
                    <p className="text-xs text-stone-500">Login: <span className="font-mono">{k.username}</span></p>
                  </div>
                  <p className="text-right">
                    <span className="font-bold text-brand">{money(t.owed)}</span>
                    <span className="block text-xs text-stone-500">owed · {money(t.paid)} paid</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h2 className="text-xl text-brand">Add a kid</h2>
          <form action={addKid} className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="display_name">Name</label>
              <input id="display_name" name="display_name" className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="birth_year">Birth year</label>
              <input id="birth_year" name="birth_year" type="number" min="2000" max="2030" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="username">Username (for login)</label>
              <input id="username" name="username" className="input" autoCapitalize="none" placeholder="sam.boyce" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Password (6+)</label>
              <input id="password" name="password" type="text" minLength={6} className="input" required />
            </div>
            <div className="sm:col-span-2"><SubmitButton className="btn w-full">Add to crew</SubmitButton></div>
          </form>
        </section>

        {kids.length > 0 && (
          <section className="card">
            <h2 className="text-xl text-brand">Record a payout</h2>
            <p className="text-sm text-stone-600">Pay outside the app (Venmo, Greenlight, cash, payroll), then log it here so balances and records stay right.</p>
            <form action={recordPayout} className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="kid_id">Kid</label>
                <select id="kid_id" name="kid_id" className="input">
                  {kids.map((k) => <option key={k.id} value={k.id}>{k.display_name}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="amount">Amount $</label>
                <input id="amount" name="amount" type="number" min="0.01" step="0.01" className="input" required />
              </div>
              <div>
                <label className="label" htmlFor="method">Method</label>
                <select id="method" name="method" className="input">
                  {["Venmo", "Greenlight", "Cash", "Bank transfer", "Payroll", "Roth IRA deposit"].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="note">Note</label>
                <input id="note" name="note" className="input" placeholder="Nov week 1" />
              </div>
              <div className="sm:col-span-2"><SubmitButton className="btn-gold w-full">Record payout & notify</SubmitButton></div>
            </form>
          </section>
        )}

        {payouts.length > 0 && (
          <section className="card">
            <div className="flex items-center justify-between">
              <h2 className="text-xl text-brand">Payout history</h2>
              <a href="/crew/export" className="btn-ghost">Download CSV</a>
            </div>
            <ul className="mt-3 divide-y divide-stone-100 text-sm">
              {payouts.slice(0, 25).map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span>{nameOf(p.kid_id)} · {p.method ?? "—"}{p.note ? ` · ${p.note}` : ""}</span>
                  <span className="font-semibold">{money(p.amount)} <span className="font-normal text-stone-400">{new Date(p.paid_at).toLocaleDateString()}</span></span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
