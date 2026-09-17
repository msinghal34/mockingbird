import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import type { VoiceProfile } from "../lib/llm/types";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** One row per X handle we have ever looked up. Shared across all users. */
export const xAccounts = pgTable("x_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Always lowercased. The natural key. */
  handle: text("handle").notNull().unique(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  followers: integer("followers"),
  /** Drives the 24h refetch window in src/lib/x/source.ts. */
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }).notNull(),
  /** "twitterapi" | "fixture" — where the tweets below actually came from. */
  source: text("source").notNull(),
});

export const tweets = pgTable(
  "tweets",
  {
    /** The X tweet id, so a refetch upserts instead of duplicating. */
    id: text("id").primaryKey(),
    xAccountId: uuid("x_account_id")
      .notNull()
      .references(() => xAccounts.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    likeCount: integer("like_count").notNull().default(0),
    retweetCount: integer("retweet_count").notNull().default(0),
    isReply: boolean("is_reply").notNull().default(false),
    isRetweet: boolean("is_retweet").notNull().default(false),
    url: text("url"),
  },
  (t) => [index("tweets_account_posted_idx").on(t.xAccountId, t.postedAt)],
);

/**
 * Stage 1 output, cached per handle. corpusHash is a digest of the tweet texts
 * that produced it, so the profile is recomputed only when the tweets change.
 */
export const voiceProfiles = pgTable("voice_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  xAccountId: uuid("x_account_id")
    .notNull()
    .unique()
    .references(() => xAccounts.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  corpusHash: text("corpus_hash").notNull(),
  profile: jsonb("profile").$type<VoiceProfile>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const generations = pgTable(
  "generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    xAccountId: uuid("x_account_id")
      .notNull()
      .references(() => xAccounts.id, { onDelete: "cascade" }),
    topic: text("topic"),
    model: text("model").notNull(),
    /** Bumped when the prompts change, so old rows stay interpretable. */
    promptVersion: text("prompt_version").notNull(),
    /** "live" | "cache" | "fixture" — what the UI badge reports. */
    tweetSource: text("tweet_source").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("generations_user_created_idx").on(t.userId, t.createdAt)],
);

export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generationId: uuid("generation_id")
      .notNull()
      .references(() => generations.id, { onDelete: "cascade" }),
    idx: integer("idx").notNull(),
    text: text("text").notNull(),
    charCount: integer("char_count").notNull(),
    rationale: text("rationale"),
  },
  (t) => [index("drafts_generation_idx").on(t.generationId, t.idx)],
);

export type User = typeof users.$inferSelect;
export type XAccount = typeof xAccounts.$inferSelect;
export type Tweet = typeof tweets.$inferSelect;
export type Generation = typeof generations.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
