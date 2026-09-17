import { describe, expect, it } from "vitest";

import { InvalidHandleError, isValidHandleInput, normalizeHandle } from "./handle";

describe("normalizeHandle", () => {
  it("accepts a bare handle", () => {
    expect(normalizeHandle("paulg")).toBe("paulg");
  });

  it("lowercases, because the upstream API is case-sensitive", () => {
    // Observed: last_tweets returns nothing for "FatimaRizwan" and 20 tweets
    // for "fatimarizwan".
    expect(normalizeHandle("FatimaRizwan")).toBe("fatimarizwan");
  });

  it.each([
    ["@paulg", "paulg"],
    ["  @paulg  ", "paulg"],
    ["@@paulg", "paulg"],
    ["https://x.com/paulg", "paulg"],
    ["https://twitter.com/paulg", "paulg"],
    ["http://www.x.com/paulg", "paulg"],
    ["x.com/paulg", "paulg"],
    ["twitter.com/paulg?s=20&t=abc", "paulg"],
    ["https://x.com/paulg/status/123", "paulg"],
    ["https://twitter.com/#!/paulg", "paulg"],
  ])("normalizes %s", (input, expected) => {
    expect(normalizeHandle(input)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "@",
    "way_too_long_a_handle",
    "has spaces",
    "has-a-dash",
    "emoji🙂",
    "https://x.com/",
    "https://example.com/paulg",
  ])("rejects %j", (input) => {
    expect(() => normalizeHandle(input)).toThrow(InvalidHandleError);
  });

  it("allows the full 15-character length but not 16", () => {
    expect(normalizeHandle("a".repeat(15))).toBe("a".repeat(15));
    expect(() => normalizeHandle("a".repeat(16))).toThrow(InvalidHandleError);
  });
});

describe("isValidHandleInput", () => {
  it("does not throw on bad input", () => {
    expect(isValidHandleInput("has spaces")).toBe(false);
    expect(isValidHandleInput("@paulg")).toBe(true);
  });
});
