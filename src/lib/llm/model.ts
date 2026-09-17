/**
 * Constants, kept out of client.ts so that tooling and tests can read them
 * without importing the `server-only` module that holds the API key.
 */

/**
 * Pinned rather than `gemini-flash-latest`: a model swap changes the voice of
 * every draft, and the id is recorded on each generation row so an old result
 * stays interpretable.
 */
export const MODEL = "gemini-3.8-flash";

/** Bump whenever the prompts in prompts.ts change materially. */
export const PROMPT_VERSION = "v1";
