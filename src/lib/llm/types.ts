import { z } from "zod";

/**
 * Stage 1 output: an explicit, inspectable description of how someone writes.
 *
 * This exists as a first-class artifact rather than living inside a prompt
 * because it is cacheable (one analysis call per handle instead of one per
 * generation) and because showing it to the user is the honest way to explain
 * why the drafts came out the way they did.
 */
export const voiceProfileSchema = z.object({
  summary: z
    .string()
    .describe("Two or three sentences describing how this person writes."),
  tone: z
    .array(z.string())
    .describe("Three to six adjectives, e.g. 'dry', 'earnest', 'combative'."),
  register: z
    .string()
    .describe("Formality and vocabulary level, in one short phrase."),
  cadence: z
    .string()
    .describe("Sentence rhythm and structure: fragments, long clauses, lists."),
  typicalLength: z
    .string()
    .describe("Typical post length and how much it varies, in one phrase."),
  punctuation: z
    .string()
    .describe("Punctuation habits: dashes, ellipses, line breaks, no periods."),
  capitalisation: z
    .string()
    .describe("Capitalisation habits: sentence case, all lowercase, Title Case."),
  emojiUsage: z.string().describe("How emoji are used, or 'none'."),
  hashtagUsage: z.string().describe("How hashtags are used, or 'none'."),
  linkUsage: z.string().describe("How links are used, or 'none'."),
  recurringTopics: z
    .array(z.string())
    .describe("Four to eight subjects this person returns to."),
  signatureMoves: z
    .array(z.string())
    .describe("Recognisable structural habits, openers or rhetorical devices."),
  avoids: z
    .array(z.string())
    .describe("Things this person never does, that an imitator would."),
});

export type VoiceProfile = z.infer<typeof voiceProfileSchema>;

/** Stage 2 output, before validation and persistence. */
export const draftBatchSchema = z.object({
  drafts: z.array(
    z.object({
      text: z.string().describe("The tweet itself. No surrounding quotes."),
      rationale: z
        .string()
        .describe("One short line on which traits of the voice this leans on."),
    }),
  ),
});

export type DraftBatch = z.infer<typeof draftBatchSchema>;
