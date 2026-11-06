import { AuthShell } from "@/components/AuthShell";
import { signup } from "../login/actions";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <AuthShell title="Set up your family crew" subtitle="Create the parent account. You'll add the kids next." error={error}>
      <form action={signup} className="space-y-4">
        <div>
          <label className="label" htmlFor="family">Family / business name</label>
          <input className="input" id="family" name="family" placeholder="The Boyce Crew" required />
        </div>
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input className="input" id="name" name="name" required />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <label className="label" htmlFor="password">Password (6+ characters — numbers OK)</label>
          <input className="input" id="password" name="password" type="password" minLength={6} autoComplete="new-password" required />
        </div>
        <button className="btn w-full">Create family</button>
      </form>
    </AuthShell>
  );
}
