import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AuthForm } from "@/components/auth-form";
import { Wordmark } from "@/components/brand";
import { signUpAction } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  if (await auth()) redirect("/app");

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-16">
      <div className="mb-8">
        <Wordmark />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          Create an account
        </h1>
        <p className="mt-1.5 text-[14px] text-muted">
          Email and a password. Nothing is sent anywhere else.
        </p>
      </div>

      <AuthForm
        action={signUpAction}
        submitLabel="Create account"
        footer={{
          prompt: "Already have one?",
          href: "/sign-in",
          linkLabel: "Sign in",
        }}
      />
    </main>
  );
}
