"use client";

import { useEffect, useState } from "react";

import { MAX_TWEET_CHARS } from "@/lib/llm/validate";

export function DraftCard({
  index,
  text,
  charCount,
  rationale,
  handle,
}: {
  index: number;
  text: string;
  charCount: number;
  rationale: string | null;
  handle: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // Clipboard is blocked in some embedded contexts; the text is selectable.
    }
  }

  const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}`;

  return (
    <article className="card group p-4 transition-colors hover:border-border-strong sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] text-subtle">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span
          className={`font-mono text-[11px] tabular-nums ${
            charCount > MAX_TWEET_CHARS ? "text-danger" : "text-subtle"
          }`}
        >
          {charCount}/{MAX_TWEET_CHARS}
        </span>
      </div>

      <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-fg">
        {text}
      </p>

      {rationale ? (
        <p className="mt-3 border-l-2 border-border pl-3 text-[13px] leading-relaxed text-muted">
          {rationale}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="btn-ghost px-3 py-1.5 text-[13px]"
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <a
          href={intentUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="btn-ghost px-3 py-1.5 text-[13px]"
        >
          Open in X
        </a>
        <span className="ml-auto text-[12px] text-subtle">
          as @{handle}
        </span>
      </div>
    </article>
  );
}
