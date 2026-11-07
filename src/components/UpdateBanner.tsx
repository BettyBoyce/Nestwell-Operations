const RAW = "https://raw.githubusercontent.com/BettyBoyce/Nestwell-Operations/main/supabase/migrations/";

/** Tells parents when a database update (migration) still needs to be run in Supabase. */
export function UpdateBanner({ files }: { files: string[] }) {
  if (!files.length) return null;
  return (
    <div className="rounded-2xl border-2 border-rust/40 bg-rust/5 p-4 text-sm">
      <p className="font-bold text-rust">⚠️ Database update needed</p>
      <p className="mt-1 text-stone-700">
        Some features (hourly shifts, schedules, routines or required photos) won&apos;t work until you run{" "}
        {files.length === 1 ? "this file" : "these files"} in <b>Supabase → SQL Editor</b> (not Vercel&apos;s Query box):
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        {files.map((f) => (
          <li key={f}>
            <a href={RAW + f} target="_blank" rel="noreferrer" className="font-semibold text-brand underline">{f}</a>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-xs text-stone-500">Open each link → select all → copy → paste into a new query → Run → look for “Success.” Then refresh this page.</p>
    </div>
  );
}
