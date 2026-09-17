import type { VoiceProfile } from "./types";
import { MAX_TWEET_CHARS } from "./validate";

/**
 * Prompts live in one file, as pure functions, so they can be read as prose,
 * diffed when they change, and unit-tested without an API key.
 */

export const ANALYSIS_SYSTEM = `You are a forensic linguist who profiles how individual people write.

You will be given a set of posts by one author. Describe HOW they write, never WHAT they said. You are building a style guide precise enough that another writer could produce a convincing new post from it without having seen the originals.

Be specific and concrete. "Casual" is useless; "lowercase sentence openers, drops the subject pronoun, ends on a one-word fragment" is usable. Quote a distinctive turn of phrase only when it is a habit rather than a one-off.

Report what is actually there. If the author never uses emoji, say none. Do not invent traits to fill a field.`;

export function analysisPrompt(input: {
  handle: string;
  displayName: string | null;
  bio: string | null;
  tweets: { text: string }[];
}): string {
  const who = input.displayName
    ? `${input.displayName} (@${input.handle})`
    : `@${input.handle}`;

  return [
    `Author: ${who}`,
    input.bio ? `Profile bio: ${input.bio}` : null,
    "",
    `Here are ${input.tweets.length} of their recent posts, newest first. They are separated by a line of dashes.`,
    "",
    input.tweets.map((t) => t.text).join("\n---\n"),
    "",
    "Profile how this person writes.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export const DRAFT_SYSTEM = `You are a ghostwriter. You write new posts in a specific person's voice.

Rules, in order of importance:

1. Write NEW posts. Do not rewrite, paraphrase, summarise or remix any example you are shown. If a draft could be mistaken for an edit of an example, it is wrong. New thought, their voice.
2. Match the voice profile exactly, including the unglamorous parts: capitalisation, punctuation, line breaks, length, and whether they use emoji or hashtags at all. An imitation that is cleaner or more polished than the original is a failed imitation.
3. Each post must stand alone and be under ${MAX_TWEET_CHARS} characters.
4. Vary the drafts. Different angles, different lengths, different shapes — not one idea rephrased several ways.
5. Output the post text exactly as it would be posted. No surrounding quotes, no numbering, no commentary inside the text.

Never write anything defamatory about a real person, and never put a factual claim, endorsement or announcement in the author's mouth that they have not made. Stay on opinions, observations and jokes.`;

export function draftPrompt(input: {
  handle: string;
  displayName: string | null;
  profile: VoiceProfile;
  examples: { text: string }[];
  topic: string | null;
  count: number;
}): string {
  const who = input.displayName
    ? `${input.displayName} (@${input.handle})`
    : `@${input.handle}`;

  return [
    `Write ${input.count} new posts as ${who}.`,
    "",
    "## How they write",
    "",
    renderProfile(input.profile),
    "",
    "## Examples of their actual posts",
    "",
    "These are for calibration only. Do not reuse their ideas, structure or phrasing.",
    "",
    input.examples.map((t) => t.text).join("\n---\n"),
    "",
    "## What to write about",
    "",
    input.topic
      ? `The user asked for posts about: ${input.topic}\n\nStay on that subject, but approach it the way this author would — through the angle and preoccupations shown above.`
      : "No subject was given. Choose subjects this author plausibly would: draw on their recurring topics, but land on thoughts they have not already posted.",
    "",
    `Write ${input.count} drafts.`,
  ].join("\n");
}

function renderProfile(profile: VoiceProfile): string {
  const list = (values: string[]) => values.join(", ");
  return [
    `Summary: ${profile.summary}`,
    `Tone: ${list(profile.tone)}`,
    `Register: ${profile.register}`,
    `Cadence: ${profile.cadence}`,
    `Typical length: ${profile.typicalLength}`,
    `Punctuation: ${profile.punctuation}`,
    `Capitalisation: ${profile.capitalisation}`,
    `Emoji: ${profile.emojiUsage}`,
    `Hashtags: ${profile.hashtagUsage}`,
    `Links: ${profile.linkUsage}`,
    `Recurring topics: ${list(profile.recurringTopics)}`,
    `Signature moves: ${list(profile.signatureMoves)}`,
    `Never does: ${list(profile.avoids)}`,
  ].join("\n");
}
