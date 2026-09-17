import type { VoiceProfile } from "@/lib/llm/types";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[13px] text-subtle">{label}</dt>
      <dd className="text-[13px] leading-relaxed text-muted">{value}</dd>
    </div>
  );
}

function Tags({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 py-2 sm:grid-cols-[9rem_1fr]">
      <dt className="text-[13px] text-subtle">{label}</dt>
      <dd className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[12px] text-muted"
          >
            {value}
          </span>
        ))}
      </dd>
    </div>
  );
}

/**
 * Renders the stage-1 artifact. This is the part of the product worth showing:
 * the drafts are downstream of these observations, so a user who disagrees
 * with the read now knows why the output missed.
 */
export function VoicePanel({
  profile,
  handle,
}: {
  profile: VoiceProfile;
  handle: string;
}) {
  return (
    <details className="card group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-[14px] text-muted transition-colors hover:text-fg sm:px-5">
        <span>
          How it read <span className="text-fg">@{handle}</span>
        </span>
        <span className="text-[12px] text-subtle transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>

      <div className="border-t border-border px-4 pb-4 sm:px-5 sm:pb-5">
        <p className="py-4 text-[14px] leading-relaxed text-fg">
          {profile.summary}
        </p>
        <dl className="divide-y divide-border border-t border-border">
          <Tags label="Tone" values={profile.tone} />
          <Row label="Register" value={profile.register} />
          <Row label="Cadence" value={profile.cadence} />
          <Row label="Typical length" value={profile.typicalLength} />
          <Row label="Punctuation" value={profile.punctuation} />
          <Row label="Capitalisation" value={profile.capitalisation} />
          <Row label="Emoji" value={profile.emojiUsage} />
          <Row label="Hashtags" value={profile.hashtagUsage} />
          <Row label="Links" value={profile.linkUsage} />
          <Tags label="Recurring topics" values={profile.recurringTopics} />
          <Tags label="Signature moves" values={profile.signatureMoves} />
          <Tags label="Never does" values={profile.avoids} />
        </dl>
      </div>
    </details>
  );
}
