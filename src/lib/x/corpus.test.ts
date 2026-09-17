import { describe, expect, it } from "vitest";

import { buildCorpus, cleanText, corpusHash, isRetweet, parseTweetDate } from "./corpus";
import type { RawTweet } from "./fetch";
import fixture from "./fixtures/msinghal34.json";

function tweet(overrides: Partial<RawTweet> & { id: string }): RawTweet {
  return {
    text: "A perfectly ordinary post, long enough to clear the minimum bar.",
    createdAt: "Sun Jan 15 16:43:28 +0000 2023",
    likeCount: 0,
    retweetCount: 0,
    isReply: false,
    retweeted_tweet: null,
    url: null,
    author: null,
    ...overrides,
  };
}

describe("parseTweetDate", () => {
  it("reads X's stamp format", () => {
    const date = parseTweetDate("Sun Jan 15 16:43:28 +0000 2023");
    expect(date?.toISOString()).toBe("2023-01-15T16:43:28.000Z");
  });

  it("returns null rather than an Invalid Date", () => {
    expect(parseTweetDate(null)).toBeNull();
    expect(parseTweetDate("not a date")).toBeNull();
  });
});

describe("cleanText", () => {
  it("strips a trailing media link", () => {
    expect(cleanText("Look at this https://t.co/abc123")).toBe("Look at this");
  });

  it("strips several trailing links", () => {
    expect(cleanText("Two https://t.co/aaa https://t.co/bbb")).toBe("Two");
  });

  it("keeps a link that is part of the sentence", () => {
    const text = "Read https://t.co/abc123 before you reply";
    expect(cleanText(text)).toBe(text);
  });

  it("keeps line breaks, which are part of how someone writes", () => {
    expect(cleanText("one\n\ntwo")).toBe("one\n\ntwo");
  });
});

describe("isRetweet", () => {
  it("catches the nested field", () => {
    expect(isRetweet(tweet({ id: "1", retweeted_tweet: { id: "x" } }))).toBe(true);
  });

  it("catches the RT prefix when the field is missing", () => {
    expect(isRetweet(tweet({ id: "1", text: "RT @someone: a thing" }))).toBe(true);
  });

  it("does not fire on an ordinary post", () => {
    expect(isRetweet(tweet({ id: "1" }))).toBe(false);
  });
});

describe("buildCorpus", () => {
  it("drops replies, retweets and one-word reactions", () => {
    const result = buildCorpus([
      tweet({ id: "keep" }),
      tweet({ id: "reply", isReply: true }),
      tweet({ id: "rt", retweeted_tweet: { id: "x" } }),
      tweet({ id: "short", text: "lol" }),
    ]);
    expect(result.map((t) => t.id)).toEqual(["keep"]);
  });

  it("dedupes posts that differ only in punctuation or case", () => {
    const result = buildCorpus([
      tweet({ id: "a", text: "Ship it, then find out what you shipped." }),
      tweet({ id: "b", text: "ship it -- then find out what you shipped!" }),
    ]);
    expect(result).toHaveLength(1);
  });

  it("orders newest first", () => {
    const result = buildCorpus([
      tweet({ id: "old", createdAt: "Mon Jan 01 00:00:00 +0000 2020" }),
      tweet({
        id: "new",
        createdAt: "Mon Jan 01 00:00:00 +0000 2024",
        text: "A different post, also comfortably past the minimum length.",
      }),
    ]);
    expect(result.map((t) => t.id)).toEqual(["new", "old"]);
  });

  it("caps the corpus size", () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      tweet({ id: String(i), text: `Post number ${i}, padded out past the minimum length bar.` }),
    );
    expect(buildCorpus(many).length).toBeLessThanOrEqual(40);
  });

  it("produces a usable corpus from the committed fixture", () => {
    const result = buildCorpus(fixture.tweets as RawTweet[]);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.text.length >= 40)).toBe(true);
    expect(result.every((t) => !t.text.endsWith("t.co"))).toBe(true);
  });
});

describe("corpusHash", () => {
  it("is stable for the same texts", () => {
    const corpus = [{ text: "one" }, { text: "two" }];
    expect(corpusHash(corpus)).toBe(corpusHash([{ text: "one" }, { text: "two" }]));
  });

  it("changes when a post changes", () => {
    expect(corpusHash([{ text: "one" }])).not.toBe(corpusHash([{ text: "two" }]));
  });

  it("is not fooled by concatenation", () => {
    // Without a separator, ["ab","c"] and ["a","bc"] would hash identically.
    expect(corpusHash([{ text: "ab" }, { text: "c" }])).not.toBe(
      corpusHash([{ text: "a" }, { text: "bc" }]),
    );
  });
});
