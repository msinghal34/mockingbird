"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { requireUser } from "@/auth";
import { LlmError, MODEL, PROMPT_VERSION } from "@/lib/llm/client";
import { generateDraftsFor, getVoiceProfile } from "@/lib/llm/generate";
import {
  countRecentGenerations,
  RATE_LIMIT_PER_HOUR,
  saveGeneration,
} from "@/lib/generations";
import { InvalidHandleError, normalizeHandle } from "@/lib/x/handle";
import { getCorpusForHandle, NoCorpusError } from "@/lib/x/source";

export type GenerateState = { error: string | null };

const inputSchema = z.object({
  handle: z.string().min(1, "Enter an X handle."),
  topic: z
    .string()
    .trim()
    .max(200, "Keep the topic under 200 characters.")
    .optional()
    .transform((value) => value || null),
  count: z.coerce.number().int().min(1).max(8).catch(5),
});

/**
 * The whole pipeline, server-side: resolve the handle, get a corpus, read the
 * voice, write the drafts, store the result. Neither API key is ever sent to
 * the browser — the client only receives text that came back from here.
 */
export async function generateAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const user = await requireUser();

  const parsed = inputSchema.safeParse({
    handle: formData.get("handle"),
    topic: formData.get("topic"),
    count: formData.get("count"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check that input." };
  }

  let handle: string;
  try {
    handle = normalizeHandle(parsed.data.handle);
  } catch (error) {
    if (error instanceof InvalidHandleError) return { error: error.message };
    throw error;
  }

  const recent = await countRecentGenerations(user.id);
  if (recent >= RATE_LIMIT_PER_HOUR) {
    return {
      error: `That's ${RATE_LIMIT_PER_HOUR} generations this hour, which is the limit. Try again shortly.`,
    };
  }

  const startedAt = Date.now();
  let generationId: string;

  try {
    const { account, corpus, source } = await getCorpusForHandle(handle);
    const { profile } = await getVoiceProfile(account, corpus);
    const { drafts } = await generateDraftsFor({
      account,
      profile,
      corpus,
      topic: parsed.data.topic,
      count: parsed.data.count,
    });

    if (drafts.length === 0) {
      return {
        error:
          "Every draft came back too close to something they'd already posted. Try again, or add a topic to push it somewhere new.",
      };
    }

    generationId = await saveGeneration({
      userId: user.id,
      xAccountId: account.id,
      topic: parsed.data.topic,
      model: MODEL,
      promptVersion: PROMPT_VERSION,
      tweetSource: source,
      latencyMs: Date.now() - startedAt,
      drafts,
    });
  } catch (error) {
    if (error instanceof NoCorpusError) return { error: error.message };
    if (error instanceof LlmError) {
      console.error("[generate] llm failure", error);
      return {
        error: "The model didn't come back with anything usable. Try again.",
      };
    }
    throw error;
  }

  // Outside the try: redirect() signals by throwing.
  redirect(`/app/g/${generationId}`);
}
