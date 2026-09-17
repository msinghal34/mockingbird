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

export class XFetchError extends Error {}

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

/** One retry, because a single network blip shouldn't cost a generation. */
async function requestJson(url: URL, apiKey: string): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });

      if (response.status === 401 || response.status === 403) {
        throw new XFetchError("The twitterapi.io key was rejected.");
      }
      if (response.status === 402) {
        throw new XFetchError("The twitterapi.io account is out of credit.");
      }
      if (!response.ok) {
        throw new XFetchError(`twitterapi.io returned HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      // A rejected key or an empty wallet won't fix itself on a retry.
      if (error instanceof XFetchError) throw error;
      lastError = error;
    }
  }

  throw new XFetchError(
    `Could not reach twitterapi.io: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}
