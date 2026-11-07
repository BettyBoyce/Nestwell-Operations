import { CrewHeader } from "@/components/CrewHeader";
import { loadCrew } from "./data";
import { KidView } from "./KidView";
import { ParentView } from "./ParentView";

export const dynamic = "force-dynamic";

export default async function CrewPage({ searchParams }: { searchParams: Promise<{ error?: string; day?: string }> }) {
  const { error, day } = await searchParams;
  const { supabase, profile, familyName, timezone, members, jobs, time, payouts, notifications, shifts, routines, checks } =
    await loadCrew();
  const isParent = profile.role === "parent";

  const proofUrls: Record<string, string[]> = {};
  if (isParent) {
    const pairs = jobs
      .filter((j) => j.status === "submitted")
      .flatMap((j) => {
        const paths = j.proof_paths?.length ? j.proof_paths : j.proof_path ? [j.proof_path] : [];
        return paths.map((p) => ({ jobId: j.id, path: p }));
      });
    if (pairs.length) {
      const { data } = await supabase.storage.from("proof").createSignedUrls(pairs.map((p) => p.path), 3600);
      pairs.forEach((p, i) => {
        const url = data?.[i]?.signedUrl;
        if (url) (proofUrls[p.jobId] ??= []).push(url);
      });
    }
  }

  return (
    <>
      <CrewHeader familyName={familyName} name={profile.display_name} isParent={isParent} notifications={notifications} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-bronze">{familyName}</p>
        <h1 className={`${profile.position_title && !isParent ? "" : "mb-4"} text-3xl text-brand`}>Hi, {profile.display_name.split(" ")[0]} 👋</h1>
        {profile.position_title && !isParent && <p className="mb-4 text-sm text-stone-600">{profile.position_title}</p>}
        {error && <p className="mb-4 rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p>}
        {isParent ? (
          <ParentView
            members={members}
            jobs={jobs}
            time={time}
            payouts={payouts}
            proofUrls={proofUrls}
            shifts={shifts}
            routines={routines}
            checks={checks}
            tz={timezone}
          />
        ) : (
          <KidView
            me={profile}
            jobs={jobs}
            time={time}
            payouts={payouts}
            shifts={shifts}
            routines={routines}
            checks={checks}
            tz={timezone}
            selectedDay={day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined}
          />
        )}
      </main>
    </>
  );
}
