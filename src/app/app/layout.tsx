import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Wordmark } from "@/components/brand";
import { signOutAction } from "@/lib/auth/actions";

/**
 * The guard for every /app route.
 *
 * A layout check rather than middleware: middleware runs on the edge runtime,
 * which would mean splitting the Auth.js config in two to keep node:crypto out
 * of it. Every server action re-checks the session itself via requireUser(),
 * so this is defence in depth rather than the only lock.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/sign-in");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-6 py-3.5">
          <Wordmark href="/app" />

          <nav className="ml-auto flex items-center gap-1">
            <Link
              href="/app"
              className="rounded-md px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
            >
              New
            </Link>
            <Link
              href="/app/history"
              className="rounded-md px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:text-fg"
            >
              History
            </Link>
            <form action={signOutAction}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-[13px] text-subtle transition-colors hover:text-fg"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
