import type { Metadata } from "next";
import Link from "next/link";

import { requireUser } from "@/auth";
import { Avatar, SourceBadge, timeAgo } from "@/components/handle-card";
import { listGenerations } from "@/lib/generations";

export const metadata: Metadata = { title: "History" };

export default async function HistoryPage() {
  const user = await requireUser();
  const generations = await listGenerations(user.id, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">History</h1>
        <p className="mt-1.5 text-[14px] text-muted">
          Everything you&apos;ve generated, newest first.
        </p>
      </div>

      {generations.length === 0 ? (
        <div className="card px-6 py-12 text-center">
          <p className="text-[14px] text-muted">Nothing here yet.</p>
          <Link href="/app" className="btn-primary mt-4">
            Write some drafts
          </Link>
        </div>
      ) : (
        <ul className="card divide-y divide-border">
          {generations.map((generation) => (
            <li key={generation.id}>
              <Link
                href={`/app/g/${generation.id}`}
                className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-surface-2"
              >
                <Avatar
                  src={generation.avatarUrl}
                  handle={generation.handle}
                  size={36}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px]">
                      @{generation.handle}
                    </span>
                    <SourceBadge source={generation.tweetSource} />
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-subtle">
                    {generation.topic ? `${generation.topic} · ` : ""}
                    {generation.draftCount} drafts ·{" "}
                    {timeAgo(generation.createdAt)}
                  </span>
                </span>
                <span className="text-subtle">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
