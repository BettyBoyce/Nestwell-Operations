import Link from "next/link";
import { AuthShell } from "@/components/AuthShell";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Welcome back, crew" subtitle="Parents use email. Crew members use the username a parent gave you." error={error}>
      <form action={login} className="space-y-4">
        <div>
          <label className="label" htmlFor="login">Email or username</label>
          <input className="input" id="login" name="login" autoComplete="username" autoCapitalize="none" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <button className="btn w-full">Log in</button>
      </form>
      <p className="mt-4 text-center text-xs text-stone-500">
        New family? <Link href="/signup" className="font-semibold text-brand">Set up your crew</Link>
      </p>
    </AuthShell>
  );
}
