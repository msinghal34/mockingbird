"use server";

import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";

import { signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";

import { hashPassword } from "./password";
import { credentialsSchema } from "./schema";

export type AuthFormState = { error: string | null };

function readCredentials(formData: FormData) {
  return credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check those details." };
  }

  const { email, password } = parsed.data;

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  });
  if (existing) {
    return {
      error: "An account with that email already exists. Sign in instead.",
    };
  }

  try {
    await db.insert(users).values({
      email,
      passwordHash: await hashPassword(password),
    });
  } catch {
    // Unique violation from a concurrent sign-up with the same address.
    return {
      error: "An account with that email already exists. Sign in instead.",
    };
  }

  // Throws a redirect on success, which must reach Next rather than be caught.
  await signIn("credentials", { email, password, redirectTo: "/app" });
  return { error: null };
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = readCredentials(formData);
  if (!parsed.success) {
    return { error: "Check your email and password." };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/app" });
  } catch (error) {
    // Deliberately identical whether the address is unknown or the password is
    // wrong, so the form can't be used to enumerate accounts.
    if (error instanceof AuthError) {
      return { error: "That email and password don't match." };
    }
    throw error;
  }
  return { error: null };
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
