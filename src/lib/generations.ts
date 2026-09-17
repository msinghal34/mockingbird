import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { drafts, generations, voiceProfiles, xAccounts } from "@/db/schema";
import type { VoiceProfile } from "@/lib/llm/types";
import type { CorpusSource } from "@/lib/x/source";
import type { ValidatedDraft } from "@/lib/llm/validate";

/** Per user. Generous for real use, tight enough to bound the API bill. */
export const RATE_LIMIT_PER_HOUR = 20;

export type GenerationSummary = {
  id: string;
  createdAt: Date;
  topic: string | null;
  model: string;
  tweetSource: string;
  latencyMs: number;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  draftCount: number;
};

export type GenerationDetail = GenerationSummary & {
  drafts: { id: string; text: string; charCount: number; rationale: string | null }[];
  /** The voice profile the drafts were written from, for the explain panel. */
  profile: VoiceProfile | null;
};

export async function countRecentGenerations(userId: string): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(generations)
    .where(
      and(eq(generations.userId, userId), gte(generations.createdAt, since)),
    );
  return row?.count ?? 0;
}

export async function saveGeneration(input: {
  userId: string;
  xAccountId: string;
  topic: string | null;
  model: string;
  promptVersion: string;
  tweetSource: CorpusSource;
  latencyMs: number;
  drafts: ValidatedDraft[];
}): Promise<string> {
  const [generation] = await db
    .insert(generations)
    .values({
      userId: input.userId,
      xAccountId: input.xAccountId,
      topic: input.topic,
      model: input.model,
      promptVersion: input.promptVersion,
      tweetSource: input.tweetSource,
      latencyMs: input.latencyMs,
    })
    .returning({ id: generations.id });

  await db.insert(drafts).values(
    input.drafts.map((draft, idx) => ({
      generationId: generation.id,
      idx,
      text: draft.text,
      charCount: draft.charCount,
      rationale: draft.rationale,
    })),
  );

  return generation.id;
}

const summarySelect = {
  id: generations.id,
  createdAt: generations.createdAt,
  topic: generations.topic,
  model: generations.model,
  tweetSource: generations.tweetSource,
  latencyMs: generations.latencyMs,
  handle: xAccounts.handle,
  displayName: xAccounts.displayName,
  avatarUrl: xAccounts.avatarUrl,
};

export async function listGenerations(
  userId: string,
  limit: number,
): Promise<GenerationSummary[]> {
  const rows = await db
    .select({
      ...summarySelect,
      draftCount: sql<number>`(select count(*)::int from ${drafts} where ${drafts.generationId} = ${generations.id})`,
    })
    .from(generations)
    .innerJoin(xAccounts, eq(generations.xAccountId, xAccounts.id))
    .where(eq(generations.userId, userId))
    .orderBy(desc(generations.createdAt))
    .limit(limit);

  return rows;
}

/**
 * Scoped to the owner in the query itself rather than checked afterwards, so
 * there is no path where a generation is loaded and then forgotten about.
 */
export async function getGeneration(
  userId: string,
  generationId: string,
): Promise<GenerationDetail | null> {
  const [row] = await db
    .select({ ...summarySelect, profile: voiceProfiles.profile })
    .from(generations)
    .innerJoin(xAccounts, eq(generations.xAccountId, xAccounts.id))
    .leftJoin(voiceProfiles, eq(voiceProfiles.xAccountId, xAccounts.id))
    .where(
      and(eq(generations.id, generationId), eq(generations.userId, userId)),
    )
    .limit(1);

  if (!row) return null;

  const draftRows = await db
    .select({
      id: drafts.id,
      text: drafts.text,
      charCount: drafts.charCount,
      rationale: drafts.rationale,
    })
    .from(drafts)
    .where(eq(drafts.generationId, generationId))
    .orderBy(drafts.idx);

  return { ...row, draftCount: draftRows.length, drafts: draftRows };
}
