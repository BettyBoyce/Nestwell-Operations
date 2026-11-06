import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Profile = {
  id: string;
  family_id: string;
  role: "parent" | "kid";
  display_name: string;
  username: string | null;
};

/** Kids log in with a username; we map it to an internal email Supabase Auth accepts. */
export const KID_EMAIL_DOMAIN = "crew.nestwell.local";
export function loginToEmail(login: string) {
  const v = login.trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${KID_EMAIL_DOMAIN}`;
}

export async function requireProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login?error=No+profile+found+for+this+account");
  return { supabase, profile: profile as Profile };
}

export async function requireParent() {
  const ctx = await requireProfile();
  if (ctx.profile.role !== "parent") redirect("/crew");
  return ctx;
}

export const money = (n: number | string | null | undefined) => `$${Number(n ?? 0).toFixed(2)}`;

export const hoursBetween = (start: string, end: string | null) =>
  ((end ? new Date(end).getTime() : Date.now()) - new Date(start).getTime()) / 3_600_000;
