import "server-only";

import { z } from "zod";

/**
 * twitterapi.io rather than the official X API: X moved every new developer to
 * pay-per-use in February 2026 ($0.005 per post read, no free tier), which is
 * ~$0.25 per handle at the corpus size we want. This is $0.15 per 1,000 tweets
 * for the same data. See the README for the trade-off.
 */
const BASE_URL = "https://api.twitterapi.io/twitter/user/last_tweets";

/** The API returns ~10 per page; this caps how many pages we pay for. */
const MAX_PAGES = 4;
const REQUEST_TIMEOUT_MS = 15_000;
/** Gap between timeline pages, to stay under the provider's rate limit. */
const PAGE_INTERVAL_MS = 1_200;

export class XFetchError extends Error {}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deliberately loose: we pick out the fields we use and let the rest through,
 * so a new field upstream doesn't fail a fetch. The documented response shape
 * puts `tweets` at the top level; the live API actually nests it under `data`,
 * so both are accepted.
 */
const authorSchema = z.object({
  userName: z.string(),
  name: z.string().nullish(),
  profilePicture: z.string().nullish(),
  description: z.string().nullish(),
  followers: z.number().nullish(),
});

const rawTweetSchema = z.object({
  id: z.string(),
  text: z.string(),
  url: z.string().nullish(),
  createdAt: z.string().nullish(),
  likeCount: z.number().nullish(),
  retweetCount: z.number().nullish(),
  isReply: z.boolean().nullish(),
  retweeted_tweet: z.unknown().nullish(),
  author: authorSchema.nullish(),
});

const responseSchema = z.object({
  status: z.string().nullish(),
  msg: z.string().nullish(),
  tweets: z.array(rawTweetSchema).nullish(),
  data: z.object({ tweets: z.array(rawTweetSchema).nullish() }).nullish(),
  has_next_page: z.boolean().nullish(),
  next_cursor: z.string().nullish(),
});

export type RawTweet = z.infer<typeof rawTweetSchema>;

export type FetchedAuthor = {
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followers: number | null;
};

export type FetchResult = {
  author: FetchedAuthor;
  tweets: RawTweet[];
};

/** Exported for the unit test, which runs it against a recorded payload. */
export function parseResponse(body: unknown): {
  tweets: RawTweet[];
  hasNextPage: boolean;
  nextCursor: string | null;
} {
  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new XFetchError("twitterapi.io returned an unexpected response.");
  }
  const { data } = parsed;
  if (data.status && data.status !== "success") {
    throw new XFetchError(data.msg || "twitterapi.io reported a failure.");
  }
  return {
    tweets: data.data?.tweets ?? data.tweets ?? [],
    hasNextPage: data.has_next_page ?? false,
    nextCursor: data.next_cursor || null,
  };
}

export function authorFromTweets(
  handle: string,
  tweets: RawTweet[],
): FetchedAuthor {
  const author = tweets.find((t) => t.author)?.author;
  return {
    handle,
    displayName: author?.name ?? null,
    avatarUrl: author?.profilePicture?.replace("_normal.", "_400x400.") ?? null,
    bio: author?.description || null,
    followers: author?.followers ?? null,
  };
}

/** Fetches up to `limit` of a handle's most recent non-reply posts. */
export async function fetchRecentTweets(
  handle: string,
  limit: number,
): Promise<FetchResult> {
  const apiKey = process.env.TWITTERAPI_IO_KEY;
  if (!apiKey) {
    throw new XFetchError("TWITTERAPI_IO_KEY is not set.");
  }

  const collected: RawTweet[] = [];
  let cursor = "";
  // Observed in practice: a valid, public handle can come back with an empty
  // first page, and an identical request a second later returns 20 tweets.
  // Without this the user is told the account has no posts, which is a lie.
  let retriedEmptyFirstPage = false;

  for (let page = 0; page < MAX_PAGES && collected.length < limit; page++) {
    // Paging flat out is enough to rate-limit ourselves. A short gap between
    // pages costs a second on a cold handle and nothing on a cached one.
    if (page > 0) await sleep(PAGE_INTERVAL_MS);

    const url = new URL(BASE_URL);
    url.searchParams.set("userName", handle);
    url.searchParams.set("includeReplies", "false");
    if (cursor) url.searchParams.set("cursor", cursor);

    const body = await requestJson(url, apiKey);
    const { tweets, hasNextPage, nextCursor } = parseResponse(body);

    if (tweets.length === 0) {
      if (collected.length === 0 && !retriedEmptyFirstPage) {
        retriedEmptyFirstPage = true;
        page--;
        continue;
      }
      break;
    }

    collected.push(...tweets);
    if (!hasNextPage || !nextCursor) break;
    cursor = nextCursor;
  }

  if (collected.length === 0) {
    throw new XFetchError(
      `@${handle} has no public posts we can read — check the spelling, or try an account that isn't private.`,
    );
  }

  return {
    author: authorFromTweets(handle, collected),
    tweets: collected.slice(0, limit),
  };
}

/**
 * Retries what can be retried, and gives up immediately on what can't.
 *
 * 429 matters most here: paging through a timeline back-to-back is enough to
 * trip the rate limit on its own, so a burst that would otherwise surface as
 * "no posts found" is just a request that needed to wait its turn. A rejected
 * key or an empty wallet, by contrast, will look exactly the same on attempt
 * three, so those fail loudly on the first try.
 */
export type StatusVerdict =
  | { kind: "ok" }
  | { kind: "retry" }
  | { kind: "fatal"; message: string };

/** Exported so the retry policy is pinned by a test rather than by memory. */
export function classifyStatus(status: number): StatusVerdict {
  if (status === 401 || status === 403) {
    return { kind: "fatal", message: "The twitterapi.io key was rejected." };
  }
  if (status === 402) {
    return { kind: "fatal", message: "The twitterapi.io account is out of credit." };
  }
  if (status === 429 || status >= 500) return { kind: "retry" };
  if (status < 200 || status >= 300) {
    return { kind: "fatal", message: `twitterapi.io returned HTTP ${status}.` };
  }
  return { kind: "ok" };
}

async function requestJson(url: URL, apiKey: string): Promise<unknown> {
  const backoffs = [1_000, 3_000, 6_000];
  let lastError: unknown;

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    if (attempt > 0) await sleep(backoffs[attempt - 1]);

    try {
      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      const verdict = classifyStatus(response.status);

      if (verdict.kind === "fatal") throw new XFetchError(verdict.message);

      if (verdict.kind === "retry") {
        lastError = new Error(`HTTP ${response.status}`);
        const retryAfter = Number(response.headers.get("retry-after"));
        if (Number.isFinite(retryAfter) && retryAfter > 0) {
          await sleep(Math.min(retryAfter * 1000, 10_000));
        }
        continue;
      }

      return await response.json();
    } catch (error) {
      if (error instanceof XFetchError) throw error;
      lastError = error;
    }
  }

  throw new XFetchError(
    `Couldn't reach twitterapi.io after ${backoffs.length + 1} attempts (${
      lastError instanceof Error ? lastError.message : String(lastError)
    }).`,
  );
}
