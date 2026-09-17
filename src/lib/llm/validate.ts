/** X's limit. Counted in code points, so an emoji is one character. */
export const MAX_TWEET_CHARS = 280;

/**
 * Above this share of a draft's character trigrams appearing in one source
 * tweet, it is a reworded copy rather than a new post in the same voice.
 * 0.7 was picked by eye against real output: paraphrases of a source tweet
 * land around 0.75-0.95, genuinely new posts on familiar topics stay below 0.5.
 */
const PLAGIARISM_THRESHOLD = 0.7;

/** Below this, trigram overlap is noise rather than evidence. */
const MIN_TRIGRAMS = 8;

export type RejectionReason = "empty" | "too-long" | "duplicate" | "copied";

export type ValidatedDraft = {
  text: string;
  rationale: string | null;
  charCount: number;
};

export type ValidationOutcome = {
  accepted: ValidatedDraft[];
  rejected: { text: string; reason: RejectionReason }[];
};

export function charCount(text: string): number {
  return [...text].length;
}

/** Models like to wrap a tweet in quotes, or hand back a bulleted list. */
export function tidyDraft(text: string): string {
  let value = text.trim();
  value = value.replace(/^```(?:\w+)?\s*/i, "").replace(/```$/, "");
  value = value.replace(/^\s*[-*•]\s+/, "");
  value = value.replace(/^\s*\d+[.)]\s+/, "");
  value = value.trim();

  // Only strip quotes that wrap the whole thing, not a quoted phrase inside it.
  const wrapped = /^(["'“‘])([\s\S]+)(["'”’])$/.exec(value);
  if (wrapped && !wrapped[2].includes(wrapped[1])) {
    value = wrapped[2].trim();
  }
  return value;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function trigrams(text: string): Set<string> {
  const normalized = normalize(text);
  const result = new Set<string>();
  for (let i = 0; i + 3 <= normalized.length; i++) {
    result.add(normalized.slice(i, i + 3));
  }
  return result;
}

/**
 * Share of the draft's trigrams that also appear in `source`. Asymmetric on
 * purpose: a short draft lifted wholesale out of a long tweet should score
 * high, which a symmetric measure like Jaccard would dilute.
 */
export function overlapRatio(draft: string, source: string): number {
  const a = trigrams(draft);
  if (a.size < MIN_TRIGRAMS) return 0;
  const b = trigrams(source);

  let shared = 0;
  for (const gram of a) if (b.has(gram)) shared++;
  return shared / a.size;
}

export function isCopy(draft: string, sources: string[]): boolean {
  return sources.some(
    (source) => overlapRatio(draft, source) >= PLAGIARISM_THRESHOLD,
  );
}

/**
 * The gate between the model and the database. A draft that is empty, over
 * length, a repeat of another draft, or a reworded source tweet never reaches
 * the user — the point of the product is new posts, not a shuffled timeline.
 */
export function validateDrafts(
  raw: { text: string; rationale?: string | null }[],
  sourceTexts: string[],
): ValidationOutcome {
  const accepted: ValidatedDraft[] = [];
  const rejected: { text: string; reason: RejectionReason }[] = [];
  const seen = new Set<string>();

  for (const candidate of raw) {
    const text = tidyDraft(candidate.text ?? "");

    if (!text) {
      rejected.push({ text, reason: "empty" });
      continue;
    }
    if (charCount(text) > MAX_TWEET_CHARS) {
      rejected.push({ text, reason: "too-long" });
      continue;
    }

    const key = normalize(text);
    if (seen.has(key)) {
      rejected.push({ text, reason: "duplicate" });
      continue;
    }
    if (isCopy(text, sourceTexts)) {
      rejected.push({ text, reason: "copied" });
      continue;
    }

    seen.add(key);
    accepted.push({
      text,
      rationale: candidate.rationale?.trim() || null,
      charCount: charCount(text),
    });
  }

  return { accepted, rejected };
}
