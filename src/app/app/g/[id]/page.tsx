import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { requireUser } from "@/auth";
import { DraftCard } from "@/components/draft-card";
import { Avatar, SourceBadge, timeAgo } from "@/components/handle-card";
import { VoicePanel } from "@/components/voice-panel";
import { getGeneration } from "@/lib/generations";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const generation = await getGeneration(user.id, id);
  return { title: generation ? `@${generation.handle}` : "Not found" };
}

export default async function GenerationPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();

  const generation = await getGeneration(user.id, id);
  // Covers both "no such generation" and "not yours" — the query is scoped to
  // the owner, so the two are indistinguishable from here, which is the point.
  if (!generation) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3.5">
        <Avatar src={generation.avatarUrl} handle={generation.handle} size={44} />

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-semibold tracking-tight">
            {generation.displayName ?? `@${generation.handle}`}
          </h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-subtle">
            <a
              href={`https://x.com/${generation.handle}`}
              target="_blank"
              rel="noreferrer noopener"
              className="hover:text-fg"
            >
              @{generation.handle}
            </a>
            <span aria-hidden>·</span>
            <span>{timeAgo(generation.createdAt)}</span>
            <SourceBadge source={generation.tweetSource} />
          </p>
        </div>

        <Link href="/app" className="btn-ghost shrink-0 px-3 py-1.5 text-[13px]">
          New
        </Link>
      </div>

      {generation.topic ? (
        <p className="text-[14px] text-muted">
          <span className="text-subtle">Topic:</span> {generation.topic}
        </p>
      ) : null}

      {generation.profile ? (
        <VoicePanel profile={generation.profile} handle={generation.handle} />
      ) : null}

      <div className="space-y-3">
        {generation.drafts.map((draft, index) => (
          <DraftCard
            key={draft.id}
            index={index}
            text={draft.text}
            charCount={draft.charCount}
            rationale={draft.rationale}
            handle={generation.handle}
          />
        ))}
      </div>

      <p className="border-t border-border pt-5 text-[12px] leading-relaxed text-subtle">
        {generation.drafts.length} drafts · {generation.model} ·{" "}
        {(generation.latencyMs / 1000).toFixed(1)}s. Drafts that came back as
        rewordings of real posts were discarded before you saw this.
      </p>
    </div>
  );
}
