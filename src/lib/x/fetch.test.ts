import { describe, expect, it } from "vitest";

import { authorFromTweets, classifyStatus, parseResponse, XFetchError } from "./fetch";
import fixture from "./fixtures/fatimarizwan.json";

describe("parseResponse", () => {
  it("reads the shape the live API actually returns (tweets under data)", () => {
    const result = parseResponse({
      status: "success",
      data: { tweets: [{ id: "1", text: "hello" }] },
      has_next_page: true,
      next_cursor: "abc",
    });
    expect(result.tweets).toHaveLength(1);
    expect(result.nextCursor).toBe("abc");
  });

  it("also reads the shape the docs describe (tweets at the top level)", () => {
    const result = parseResponse({
      tweets: [{ id: "1", text: "hello" }],
      has_next_page: false,
    });
    expect(result.tweets).toHaveLength(1);
    expect(result.hasNextPage).toBe(false);
  });

  it("treats an empty page as empty rather than an error", () => {
    // The API does this intermittently for valid handles, which is why
    // fetchRecentTweets retries the first page once.
    const result = parseResponse({ status: "success", data: { tweets: [] } });
    expect(result.tweets).toEqual([]);
  });

  it("normalises a missing cursor to null", () => {
    const result = parseResponse({ tweets: [], has_next_page: true, next_cursor: "" });
    expect(result.nextCursor).toBeNull();
  });

  it("raises a reported failure", () => {
    expect(() => parseResponse({ status: "error", msg: "bad key" })).toThrow(
      XFetchError,
    );
  });

  it("raises on a response that is not the right shape at all", () => {
    expect(() => parseResponse({ tweets: "nope" })).toThrow(XFetchError);
  });

  it("tolerates unknown fields, so an upstream addition doesn't break a fetch", () => {
    const result = parseResponse({
      data: { tweets: [{ id: "1", text: "hi", somethingNew: 42 }] },
      brandNewTopLevelField: true,
    });
    expect(result.tweets).toHaveLength(1);
  });

  it("parses the recorded fixture payload", () => {
    const result = parseResponse({ data: { tweets: fixture.tweets } });
    expect(result.tweets.length).toBe(fixture.tweets.length);
  });
});

describe("authorFromTweets", () => {
  it("lifts the profile off the first tweet that carries one", () => {
    const author = authorFromTweets("someone", [
      { id: "1", text: "a", author: null },
      {
        id: "2",
        text: "b",
        author: {
          userName: "someone",
          name: "Some One",
          profilePicture: "https://pbs.twimg.com/profile_images/1/a_normal.jpg",
          description: "bio",
          followers: 10,
        },
      },
    ]);
    expect(author.displayName).toBe("Some One");
    // _normal is 48x48; the UI renders at 44 on a retina screen.
    expect(author.avatarUrl).toContain("_400x400.");
  });

  it("copes with no author anywhere", () => {
    const author = authorFromTweets("someone", [{ id: "1", text: "a" }]);
    expect(author).toEqual({
      handle: "someone",
      displayName: null,
      avatarUrl: null,
      bio: null,
      followers: null,
    });
  });
});

describe("classifyStatus", () => {
  it("retries a rate limit rather than giving up", () => {
    // Paging a timeline back-to-back trips this on its own; treating it as
    // fatal showed the user "no posts found" for a perfectly good handle.
    expect(classifyStatus(429).kind).toBe("retry");
  });

  it("retries server-side failures", () => {
    expect(classifyStatus(500).kind).toBe("retry");
    expect(classifyStatus(502).kind).toBe("retry");
    expect(classifyStatus(503).kind).toBe("retry");
  });

  it("fails fast on a bad key or an empty wallet", () => {
    // These look identical on attempt three, so retrying only wastes time.
    for (const status of [401, 403, 402]) {
      expect(classifyStatus(status).kind).toBe("fatal");
    }
    expect(classifyStatus(402)).toMatchObject({ message: expect.stringContaining("credit") });
    expect(classifyStatus(401)).toMatchObject({ message: expect.stringContaining("rejected") });
  });

  it("fails fast on other client errors", () => {
    expect(classifyStatus(400).kind).toBe("fatal");
    expect(classifyStatus(404).kind).toBe("fatal");
  });

  it("passes success through", () => {
    expect(classifyStatus(200).kind).toBe("ok");
    expect(classifyStatus(204).kind).toBe("ok");
  });
});
