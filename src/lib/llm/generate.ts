import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { voiceProfiles } from "@/db/schema";
import { corpusHash, type CorpusTweet } from "@/lib/x/corpus";

import { generateJson, MODEL } from "./client";
import { analysisPrompt, ANALYSIS_SYSTEM, draftPrompt, DRAFT_SYSTEM } from "./prompts";
import { draftBatchSchema, voiceProfileSchema, type VoiceProfile } from "./types";
import { validateDrafts, type ValidatedDraft } from "./validate";

/** How many real posts to show the model when generating. */
const EXAMPLE_COUNT = 15;

/** Ask for more than we need, because validation rejects some. */
const OVERSHOOT = 2;

type Account = {
  id: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
};

/**
 * Stage 1. Cached per handle and keyed on a hash of the corpus, so this costs
 * one model call the first time a handle is used and nothing after that until
 * the person posts something new.
 */
export async function getVoiceProfile(
  account: Account,
  corpus: CorpusTweet[],
): Promise<{ profile: VoiceProfile; cached: boolean }> {
  const hash = corpusHash(corpus);

  const existing = await db.query.voiceProfiles.findFirst({
    where: eq(voiceProfiles.xAccountId, account.id),
  });

  if (existing && existing.corpusHash === hash && existing.model === MODEL) {
    return { profile: existing.profile, cached: true };
  }

  const profile = await generateJson({
    schema: voiceProfileSchema,
    system: ANALYSIS_SYSTEM,
    prompt: analysisPrompt({
      handle: account.handle,
      displayName: account.displayName,
      bio: account.bio,
      tweets: corpus,
    }),
    // Low: this is a description of observable facts, not a creative task.
    temperature: 0.2,
  });

  await db
    .insert(voiceProfiles)
    .values({
      xAccountId: account.id,
      model: MODEL,
      corpusHash: hash,
      profile,
    })
    .onConflictDoUpdate({
      target: voiceProfiles.xAccountId,
      set: { model: MODEL, corpusHash: hash, profile, createdAt: new Date() },
    });

  return { profile, cached: false };
}

/**
 * Stage 2. Generates, validates, and tops up once if validation rejected
 * enough drafts to leave us short. One retry only — a model that cannot stop
 * paraphrasing its examples will not be talked round by a third attempt, and
 * returning four good drafts beats burning quota to reach five.
 */
export async function generateDraftsFor(input: {
  account: Account;
  profile: VoiceProfile;
  corpus: CorpusTweet[];
  topic: string | null;
  count: number;
}): Promise<{ drafts: ValidatedDraft[]; rejectedCount: number }> {
  const sourceTexts = input.corpus.map((tweet) => tweet.text);
  const examples = input.corpus.slice(0, EXAMPLE_COUNT);

  const accepted: ValidatedDraft[] = [];
  let rejectedCount = 0;

  for (let attempt = 0; attempt < 2 && accepted.length < input.count; attempt++) {
    const shortfall = input.count - accepted.length;
    const batch = await generateJson({
      schema: draftBatchSchema,
      system: DRAFT_SYSTEM,
      prompt: draftPrompt({
        handle: input.account.handle,
        displayName: input.account.displayName,
        profile: input.profile,
        examples,
        topic: input.topic,
        count: shortfall + OVERSHOOT,
      }),
      // High: the failure mode here is blandness, not incoherence.
      temperature: 0.95,
    });

    const { accepted: batchAccepted, rejected } = validateDrafts(
      batch.drafts,
      // Already-accepted drafts join the "don't repeat this" set, so the
      // top-up round can't hand back what the first round already produced.
      [...sourceTexts, ...accepted.map((d) => d.text)],
    );

    rejectedCount += rejected.length;
    accepted.push(...batchAccepted);
  }

  return { drafts: accepted.slice(0, input.count), rejectedCount };
}
