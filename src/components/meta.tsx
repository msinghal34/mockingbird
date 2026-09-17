/** Relative time, without pulling in a date library for three call sites. */
export function timeAgo(date: Date): string {
  const seconds = Math.max(0, Math.round((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";

  const units: [number, string][] = [
    [60, "minute"],
    [60, "hour"],
    [24, "day"],
    [30, "month"],
    [12, "year"],
  ];

  let value = seconds;
  let label = "second";
  for (const [size, name] of units) {
    if (value < size) break;
    value = Math.floor(value / size);
    label = name;
  }
  return `${value} ${label}${value === 1 ? "" : "s"} ago`;
}

/**
 * Says where the tweets came from. The distinction matters: a fixture is real
 * text this person wrote, but it was captured on a date rather than read just
 * now, and the UI should not imply otherwise.
 */
export function SourceBadge({
  source,
  fetchedAt,
}: {
  source: string;
  fetchedAt?: Date;
}) {
  const styles = "rounded-full border px-2 py-0.5 text-[11px] font-medium";

  if (source === "fixture") {
    return (
      <span
        className={`${styles} border-accent/30 bg-accent-soft text-accent`}
        title="Served from posts committed to the repo, because the live API was unavailable."
      >
        sample data
      </span>
    );
  }
  if (source === "cache") {
    return (
      <span
        className={`${styles} border-border bg-surface-2 text-subtle`}
        title="Read from our database rather than re-fetched, to avoid paying for the same posts twice."
      >
        cached{fetchedAt ? ` · ${timeAgo(fetchedAt)}` : ""}
      </span>
    );
  }
  return (
    <span
      className={`${styles} border-emerald-500/25 bg-emerald-500/10 text-emerald-400`}
      title="Fetched from X just now."
    >
      live
    </span>
  );
}
