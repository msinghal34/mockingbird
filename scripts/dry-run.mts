/**
 * Runs the two-stage pipeline against a committed fixture, with no database
 * and nothing persisted. This is how the prompts in src/lib/llm/prompts.ts
 * were iterated on — it shows the voice profile and the drafts, and reports
 * what validation threw away and why.
 *
 *   npx tsx scripts/dry-run.ts msinghal34 "deadlines"
 *
 * It re-implements the Gemini call rather than importing src/lib/llm/client.ts
 * because that module is `server-only` and would throw outside Next.
 */
import { config } from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { MODEL } from "../src/lib/llm/model";
import {
  analysisPrompt,
  ANALYSIS_SYSTEM,
  draftPrompt,
  DRAFT_SYSTEM,
} from "../src/lib/llm/prompts";
import { draftBatchSchema, voiceProfileSchema } from "../src/lib/llm/types";
import { validateDrafts } from "../src/lib/llm/validate";
import { buildCorpus } from "../src/lib/x/corpus";
import type { RawTweet } from "../src/lib/x/fetch";

config({ path: ".env.local", quiet: true });

const handle = (process.argv[2] ?? "msinghal34").toLowerCase();
const topic = process.argv[3] ?? null;

const fixture = (await import(`../src/lib/x/fixtures/${handle}.json`, {
  with: { type: "json" },
}).catch(() => null)) as { default: { tweets: RawTweet[] } } | null;

if (!fixture) {
  console.error(`No fixture for @${handle}. Capture one first:`);
  console.error(`  ./scripts/capture-fixture.sh ${handle}`);
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function ask<T extends z.ZodType>(
  schema: T,
  system: string,
  prompt: string,
  temperature: number,
): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(schema, {
    target: "draft-7",
    io: "output",
  }) as Record<string, unknown>;
  delete jsonSchema.$schema;

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: system,
      temperature,
      responseMimeType: "application/json",
      responseJsonSchema: jsonSchema,
    },
  });
  return schema.parse(JSON.parse(response.text!));
}

const corpus = buildCorpus(fixture.default.tweets);
console.log(`corpus: ${corpus.length} posts from @${handle}\n`);

const t0 = Date.now();
const profile = await ask(
  voiceProfileSchema,
  ANALYSIS_SYSTEM,
  analysisPrompt({ handle, displayName: null, bio: null, tweets: corpus }),
  0.2,
);
console.log(`--- voice profile (${Date.now() - t0}ms) ---`);
console.log(JSON.stringify(profile, null, 2));

const t1 = Date.now();
const batch = await ask(
  draftBatchSchema,
  DRAFT_SYSTEM,
  draftPrompt({
    handle,
    displayName: null,
    profile,
    examples: corpus.slice(0, 15),
    topic,
    count: 7,
  }),
  0.95,
);

const { accepted, rejected } = validateDrafts(
  batch.drafts,
  corpus.map((t) => t.text),
);

console.log(`\n--- drafts (${Date.now() - t1}ms) ---`);
for (const [i, draft] of accepted.entries()) {
  console.log(`\n[${i + 1}] (${draft.charCount})`);
  console.log(draft.text);
  if (draft.rationale) console.log(`    ↳ ${draft.rationale}`);
}

console.log(`\n--- rejected: ${rejected.length} ---`);
for (const r of rejected) {
  console.log(`[${r.reason}] ${r.text.slice(0, 100)}`);
}
