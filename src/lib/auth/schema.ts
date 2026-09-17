import { z } from "zod";

/**
 * Shared by the sign-in form, the sign-up action and the Auth.js authorize
 * callback, so the rules cannot drift between the three.
 */
export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("That doesn't look like an email address.")),
  password: z
    .string()
    .min(8, "Use at least 8 characters.")
    .max(200, "That password is too long."),
});

export type Credentials = z.infer<typeof credentialsSchema>;
