import Link from "next/link";

import { requireUser } from "@/auth";
import { GenerateForm } from "@/components/generate-form";
import { Avatar, timeAgo } from "@/components/handle-card";
import { listGenerations } from "@/lib/generations";
import { DEMO_HANDLES } from "@/lib/x/fixtures";

import { generateAction } from "./actions";

export default async function AppPage() {
  const user = await requireUser();
  const recent = await listGenerations(user.id, 5);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Write in someone&apos;s voice
        </h1>
        <p className="mt-1.5 text-[14px] text-muted">
          Drafts only. Nothing gets posted.
        </p>
      </div>

      <GenerateForm action={generateAction} demoHandles={DEMO_HANDLES} />

      {recent.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[13px] font-medium tracking-wide text-subtle uppercase">
              Recent
            </h2>
            <Link
              href="/app/history"
              className="text-[13px] text-subtle transition-colors hover:text-fg"
            >
              All
            </Link>
          </div>

          <ul className="card divide-y divide-border">
            {recent.map((generation) => (
              <li key={generation.id}>
                <Link
                  href={`/app/g/${generation.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
                >
                  <Avatar
                    src={generation.avatarUrl}
                    handle={generation.handle}
                    size={32}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px]">
                      @{generation.handle}
                      {generation.topic ? (
                        <span className="text-muted"> · {generation.topic}</span>
                      ) : null}
                    </span>
                    <span className="block text-[12px] text-subtle">
                      {generation.draftCount} drafts ·{" "}
                      {timeAgo(generation.createdAt)}
                    </span>
                  </span>
                  <span className="text-subtle">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
