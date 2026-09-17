import { describe, expect, it } from "vitest";

import { authorFromTweets, parseResponse, XFetchError } from "./fetch";
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
