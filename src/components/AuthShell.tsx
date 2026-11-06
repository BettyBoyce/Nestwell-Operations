import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  error,
  children,
}: {
  title: string;
  subtitle: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" aria-label="Nestwell Operations home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/nestwell-logo.png" alt="Nestwell" className="h-10 w-auto" />
      </Link>
      <h1 className="mt-2 text-2xl font-bold">{title}</h1>
      <p className="mt-1 text-sm text-stone-600">{subtitle}</p>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="card mt-6">{children}</div>
    </main>
  );
}
