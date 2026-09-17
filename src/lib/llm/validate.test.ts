import { describe, expect, it } from "vitest";

import {
  charCount,
  isCopy,
  MAX_TWEET_CHARS,
  overlapRatio,
  tidyDraft,
  validateDrafts,
} from "./validate";

describe("charCount", () => {
  it("counts an emoji as one character, the way X does", () => {
    expect(charCount("hi 👋")).toBe(4);
    expect(charCount("👨‍👩‍👧")).toBeLessThan("👨‍👩‍👧".length);
  });
});

describe("tidyDraft", () => {
  it("unwraps quotes the model added around the whole post", () => {
    expect(tidyDraft('"ship it"')).toBe("ship it");
    expect(tidyDraft("“ship it”")).toBe("ship it");
  });

  it("leaves a quoted phrase inside the post alone", () => {
    const text = 'he said "ship it" and left';
    expect(tidyDraft(text)).toBe(text);
  });

  it("strips list and code-fence scaffolding", () => {
    expect(tidyDraft("- ship it")).toBe("ship it");
    expect(tidyDraft("1. ship it")).toBe("ship it");
    expect(tidyDraft("```\nship it\n```")).toBe("ship it");
  });
});

describe("overlapRatio", () => {
  it("scores a lifted sentence high", () => {
    const source = "You will be unhappy whenever your expectations are not met.";
    expect(overlapRatio(source, source)).toBe(1);
  });

  it("scores an unrelated post low", () => {
    const ratio = overlapRatio(
      "The train was late again and nobody said why",
      "You will be unhappy whenever your expectations are not met",
    );
    expect(ratio).toBeLessThan(0.5);
  });

  it("ignores very short drafts rather than guessing", () => {
    expect(overlapRatio("ok", "ok then")).toBe(0);
  });
});

describe("isCopy", () => {
  const source = "Stop thinking too much. Just do it!";

  it("catches a reworded source post", () => {
    expect(isCopy("Stop thinking so much — just do it.", [source])).toBe(true);
  });

  it("lets a genuinely new post on the same theme through", () => {
    expect(
      isCopy("Overthinking is just fear wearing a planning hat.", [source]),
    ).toBe(false);
  });
});

describe("validateDrafts", () => {
  const sources = ["Stop thinking too much. Just do it!"];

  it("accepts good drafts and reports why the rest were dropped", () => {
    const { accepted, rejected } = validateDrafts(
      [
        { text: "Overthinking is just fear wearing a planning hat." },
        { text: "" },
        { text: "x".repeat(MAX_TWEET_CHARS + 1) },
        { text: "Stop thinking so much — just do it." },
        { text: "Overthinking is just fear wearing a planning hat." },
      ],
      sources,
    );

    expect(accepted).toHaveLength(1);
    expect(rejected.map((r) => r.reason)).toEqual([
      "empty",
      "too-long",
      "copied",
      "duplicate",
    ]);
  });

  it("accepts a draft of exactly the limit", () => {
    const { accepted } = validateDrafts([{ text: "a".repeat(MAX_TWEET_CHARS) }], []);
    expect(accepted).toHaveLength(1);
  });

  it("records the tidied text and its length, not the raw text", () => {
    const { accepted } = validateDrafts([{ text: '  "a real draft here"  ' }], []);
    expect(accepted[0].text).toBe("a real draft here");
    expect(accepted[0].charCount).toBe("a real draft here".length);
  });

  it("keeps a rationale when there is one and nulls an empty one", () => {
    const { accepted } = validateDrafts(
      [
        { text: "first draft, long enough to count", rationale: " leans dry " },
        { text: "second draft, also long enough", rationale: "  " },
      ],
      [],
    );
    expect(accepted[0].rationale).toBe("leans dry");
    expect(accepted[1].rationale).toBeNull();
  });
});
