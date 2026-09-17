import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { tweets as tweetsTable, xAccounts } from "@/db/schema";

import { buildCorpus, MAX_CORPUS_TWEETS, type CorpusTweet } from "./corpus";
import { fixtureFor } from "./fixtures";
import {
  authorFromTweets,
  fetchRecentTweets,
  XFetchError,
  type FetchedAuthor,
  type RawTweet,
} from "./fetch";

/** How long a stored corpus is considered current. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/** How many raw posts to ask for, knowing replies and retweets get dropped. */
const FETCH_LIMIT = 60;

export type CorpusSource = "live" | "cache" | "fixture";

export type CorpusResult = {
  account: {
    id: string;
    handle: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio: string | null;
    followers: number | null;
    lastFetchedAt: Date;
  };
  corpus: CorpusTweet[];
  source: CorpusSource;
};

export class NoCorpusError extends Error {}

/**
 * The only way the app gets tweets.
 *
 * Order of preference: a corpus stored in the last 24h, then a live fetch,
 * then a committed fixture, then a stale stored corpus. The caller is told
 * which it got so the UI can say so rather than implying everything is live.
 */
export async function getCorpusForHandle(
  handle: string,
): Promise<CorpusResult> {
  const existing = await db.query.xAccounts.findFirst({
    where: eq(xAccounts.handle, handle),
  });

  if (existing && Date.now() - existing.lastFetchedAt.getTime() < CACHE_TTL_MS) {
    const corpus = await loadStoredCorpus(existing.id);
    if (corpus.length > 0) {
      return { account: existing, corpus, source: "cache" };
    }
  }

  try {
    const { author, tweets } = await fetchRecentTweets(handle, FETCH_LIMIT);
    return await persist(author, tweets, "live");
  } catch (error) {
    if (!(error instanceof XFetchError)) throw error;

    // Falling back is the designed behaviour, but it should never be silent:
    // "sample data" in the UI is a symptom, and this is the cause.
    console.error(`[x/source] live fetch failed for @${handle}:`, error.message);

    const fixture = fixtureFor(handle);
    if (fixture) {
      return await persist(
        authorFromTweets(handle, fixture.tweets),
        fixture.tweets,
        "fixture",
      );
    }

    // A stale corpus beats no answer at all.
    if (existing) {
      const corpus = await loadStoredCorpus(existing.id);
      if (corpus.length > 0) {
        return { account: existing, corpus, source: "cache" };
      }
    }

    throw new NoCorpusError(error.message);
  }
}

async function loadStoredCorpus(accountId: string): Promise<CorpusTweet[]> {
  const rows = await db
    .select()
    .from(tweetsTable)
    .where(
      and(
        eq(tweetsTable.xAccountId, accountId),
        eq(tweetsTable.isRetweet, false),
      ),
    )
    .orderBy(desc(tweetsTable.postedAt))
    .limit(MAX_CORPUS_TWEETS);

  return rows.map((row) => ({
    id: row.id,
    text: row.text,
    postedAt: row.postedAt,
    likeCount: row.likeCount,
    retweetCount: row.retweetCount,
    isReply: row.isReply,
    isRetweet: row.isRetweet,
    url: row.url,
  }));
}

async function persist(
  author: FetchedAuthor,
  raw: RawTweet[],
  source: CorpusSource,
): Promise<CorpusResult> {
  const corpus = buildCorpus(raw);
  if (corpus.length === 0) {
    throw new NoCorpusError(
      `@${author.handle} has posts, but none long enough to read a voice from. Try an account that writes in sentences.`,
    );
  }

  const now = new Date();
  const [account] = await db
    .insert(xAccounts)
    .values({
      handle: author.handle,
      displayName: author.displayName,
      avatarUrl: author.avatarUrl,
      bio: author.bio,
      followers: author.followers,
      lastFetchedAt: now,
      source: source === "fixture" ? "fixture" : "twitterapi",
    })
    .onConflictDoUpdate({
      target: xAccounts.handle,
      set: {
        displayName: author.displayName,
        avatarUrl: author.avatarUrl,
        bio: author.bio,
        followers: author.followers,
        lastFetchedAt: now,
        source: source === "fixture" ? "fixture" : "twitterapi",
      },
    })
    .returning();

  await db
    .insert(tweetsTable)
    .values(
      corpus.map((tweet) => ({
        id: tweet.id,
        xAccountId: account.id,
        text: tweet.text,
        postedAt: tweet.postedAt,
        likeCount: tweet.likeCount,
        retweetCount: tweet.retweetCount,
        isReply: tweet.isReply,
        isRetweet: tweet.isRetweet,
        url: tweet.url,
      })),
    )
    .onConflictDoUpdate({
      target: tweetsTable.id,
      set: { text: sqlExcluded("text"), likeCount: sqlExcluded("like_count") },
    });

  return { account, corpus, source };
}

/** Small helper so the upsert reads as SQL rather than as Drizzle ceremony. */
function sqlExcluded(column: string) {
  return sql.raw(`excluded.${column}`);
}
