import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { Wordmark } from "@/components/brand";
import { signInAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await auth()) redirect("/app");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-8">
        <Wordmark />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Sign in
        </h1>
        <p className="mt-1.5 text-[14px] text-muted">
          Your drafts are saved to your account.
        </p>
      </div>

      <AuthForm
        action={signInAction}
        submitLabel="Sign in"
        footer={{
          prompt: "No account yet?",
          href: "/sign-up",
          linkLabel: "Create one",
        }}
      />
    </main>
  );
}
