/**
 * X handles are 1-15 characters of [A-Za-z0-9_]. Anything else is either a
 * typo or an attempt to make us fetch a URL of someone else's choosing, so
 * this is the only gate between user input and the outbound request.
 */
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

export class InvalidHandleError extends Error {
  constructor(input: string) {
    super(`"${input}" is not a valid X handle.`);
  }
}

/**
 * Accepts what people actually paste: "@paulg", "paulg",
 * "https://x.com/paulg", "twitter.com/paulg?s=20", with stray whitespace.
 * Returns the lowercased bare handle, which is the key everything else uses.
 */
export function normalizeHandle(input: string): string {
  let value = input.trim();

  // Strip a URL down to its first path segment.
  const urlMatch = value.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/(?:#!\/)?([^/?#]+)/i,
  );
  if (urlMatch) {
    value = urlMatch[1];
  }

  value = value.replace(/^@+/, "").trim();

  if (!HANDLE_RE.test(value)) {
    throw new InvalidHandleError(input);
  }
  return value.toLowerCase();
}

/** Non-throwing variant, for form validation. */
export function isValidHandleInput(input: string): boolean {
  try {
    normalizeHandle(input);
    return true;
  } catch {
    return false;
  }
}
