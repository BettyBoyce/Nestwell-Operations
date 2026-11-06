import { CrewHeader } from "@/components/CrewHeader";
import { loadCrew } from "./data";
import { KidView } from "./KidView";
import { ParentView } from "./ParentView";

export const dynamic = "force-dynamic";

export default async function CrewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const { supabase, profile, familyName, members, jobs, time, payouts, notifications } = await loadCrew();
  const isParent = profile.role === "parent";

  let proofUrls: Record<string, string> = {};
  if (isParent) {
    const withProof = jobs.filter((j) => j.status === "submitted" && j.proof_path);
    if (withProof.length) {
      const { data } = await supabase.storage.from("proof").createSignedUrls(withProof.map((j) => j.proof_path!), 3600);
      proofUrls = Object.fromEntries(
        withProof.map((j, i) => [j.id, data?.[i]?.signedUrl]).filter(([, url]) => url) as [string, string][],
      );
    }
  }

  return (
    <>
      <CrewHeader familyName={familyName} name={profile.display_name} isParent={isParent} notifications={notifications} />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-bronze">{familyName}</p>
        <h1 className="mb-4 text-3xl text-brand">Hi, {profile.display_name.split(" ")[0]} 👋</h1>
        {error && <p className="mb-4 rounded-xl bg-rust/10 px-3 py-2 text-sm text-rust">{error}</p>}
        {isParent ? (
          <ParentView members={members} jobs={jobs} time={time} payouts={payouts} proofUrls={proofUrls} />
        ) : (
          <KidView me={profile} jobs={jobs} time={time} payouts={payouts} />
        )}
      </main>
    </>
  );
}
