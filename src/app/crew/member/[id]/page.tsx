import { requireParent } from "@/lib/auth";
import { loadCrew } from "../../data";
import { MAX_WEEKS_BACK, MemberWeek } from "./MemberWeek";

export const dynamic = "force-dynamic";

export default async function MemberWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  await requireParent();
  const { id } = await params;
  const back = Math.min(MAX_WEEKS_BACK, Math.max(0, Number((await searchParams).w) || 0));
  const data = await loadCrew();
  const sign = async (paths: string[]) => {
    const { data: urls } = await data.supabase.storage.from("proof").createSignedUrls(paths, 3600);
    return paths.map((_, i) => urls?.[i]?.signedUrl ?? null);
  };
  return <MemberWeek data={data} id={id} back={back} sign={sign} />;
}
