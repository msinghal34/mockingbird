"use client";

import { useEffect } from "react";

/**
 * Anything that escapes a server action or a page lands here.
 *
 * In practice the realistic cause is a transient database or upstream blip, so
 * the page offers a retry rather than an apology, and never shows the raw
 * message — it can carry connection strings and internal hostnames.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        That didn&apos;t work
      </h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        Something failed on our side. It&apos;s usually temporary — try again,
        and nothing you&apos;ve already generated is affected.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" onClick={reset} className="btn-primary">
          Try again
        </button>
        <a href="/app" className="btn-ghost">
          Back to the app
        </a>
      </div>

      {error.digest ? (
        <p className="mt-6 font-mono text-[11px] text-subtle">
          reference: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
