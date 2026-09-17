import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/auth/password";
import { credentialsSchema } from "@/lib/auth/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
    };
  }
}

/**
 * Auth.js v5 with a credentials provider and JWT sessions.
 *
 * No database adapter: a credentials provider requires the JWT strategy
 * anyway, so an adapter would add three tables that nothing reads. The `users`
 * table is ours, written by the sign-up action in lib/auth/actions.ts.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/sign-in" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await db.query.users.findFirst({
          where: eq(users.email, email),
        });

        // Verify against a dummy hash when the address is unknown, so the
        // response time doesn't reveal whether an account exists.
        const hash = user?.passwordHash ?? DUMMY_HASH;
        const ok = await verifyPassword(password, hash);

        if (!user || !ok) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.email = token.email!;
      return session;
    },
  },
});

/**
 * A genuine scrypt hash of a random string nobody holds. It has to be a valid
 * hash with the real parameters, otherwise verifyPassword bails on the format
 * check and returns early — which would reintroduce exactly the timing
 * difference this is here to remove.
 */
const DUMMY_HASH =
  "scrypt$131072$8$1$EFWMPafMl5Vf886jEX/nZw==$" +
  "O6oYnWVGARbpsOftWXBhZuBeRHwxp36YyPzvcEyF2TVNx4MmcKqdPL6YpaEFX2xOGYEeUzKgzXLd3+87iJaHhA==";

/** Throws rather than redirecting — for server actions that must have a user. */
export async function requireUser(): Promise<{ id: string; email: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Not signed in.");
  }
  return { id: session.user.id, email: session.user.email };
}
