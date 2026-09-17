"use client";

import { useState } from "react";

/**
 * A plain <img>, not next/image.
 *
 * The only images here are X profile pictures: one per page, already small,
 * served from a CDN, and on a host we don't control. next/image would either
 * proxy them through our own function for no gain, or run with `unoptimized`
 * and emit the same <img> anyway — while still needing a remotePatterns entry.
 *
 * What actually matters is the failure case. A third-party avatar that 404s or
 * is blocked should leave initials behind, not an empty circle.
 */
export function Avatar({
  src,
  handle,
  size = 40,
}: {
  src: string | null;
  handle: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className="flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-[13px] font-semibold text-subtle"
        aria-hidden
      >
        {handle.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full border border-border object-cover"
    />
  );
}
