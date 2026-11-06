import Link from "next/link";

const products = [
  {
    name: "Crew",
    href: "/crew",
    status: "Live",
    blurb: "Jobs, time clock and earnings for the family crew. Claim extra jobs, get approved, get paid.",
  },
  { name: "Turnover Checklists", status: "Planned", blurb: "Move-in / move-out checklists for furnished mid-term stays, with photo proof." },
  { name: "Inventory & Restock", status: "Planned", blurb: "Track linens and supplies per property and auto-build the shopping list." },
  { name: "Guest Welcome Kits", status: "Planned", blurb: "Welcome kits for traveling nurses and insurance-housing families." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand">Nestwell</p>
      <h1 className="mt-1 text-3xl font-bold">Nestwell Operations</h1>
      <p className="mt-2 text-stone-600">The home base for running Nestwell — built by and for the family.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {products.map((p) => {
          const body = (
            <div className="card h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{p.name}</h2>
                <span
                  className={`pill ${p.status === "Live" ? "bg-brand-soft text-brand" : "bg-stone-100 text-stone-500"}`}
                >
                  {p.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-stone-600">{p.blurb}</p>
            </div>
          );
          return p.href ? (
            <Link key={p.name} href={p.href} className="block transition hover:-translate-y-0.5">
              {body}
            </Link>
          ) : (
            <div key={p.name} className="opacity-80">
              {body}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <Link href="/login" className="btn">Log in</Link>
        <Link href="/signup" className="btn-ghost">Set up your family</Link>
      </div>
    </main>
  );
}
