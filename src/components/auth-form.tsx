"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { AuthFormState } from "@/lib/auth/actions";

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending ? "Working…" : label}
    </button>
  );
}

export function AuthForm({
  action,
  submitLabel,
  footer,
}: {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  footer: { prompt: string; href: string; linkLabel: string };
}) {
  const [state, formAction] = useActionState(action, { error: null });
  // Controlled, so a rejected submit doesn't wipe what they typed. The action
  // result re-renders the form, and an uncontrolled input would reset to empty
  // — meaning one wrong password costs you your email address too.
  const [email, setEmail] = useState("");

  return (
    <>
      <form action={formAction} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={8}
            placeholder="At least 8 characters"
            className="field"
          />
        </div>

        {state.error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[13px] text-danger"
          >
            {state.error}
          </p>
        ) : null}

        <Submit label={submitLabel} />
      </form>

      <p className="mt-6 text-center text-[13px] text-subtle">
        {footer.prompt}{" "}
        <Link href={footer.href} className="text-accent hover:underline">
          {footer.linkLabel}
        </Link>
      </p>
    </>
  );
}
