"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import type { GenerateState } from "@/app/app/actions";
import { isValidHandleInput } from "@/lib/x/handle";

/**
 * Generation takes ten to twenty seconds: two model calls, sometimes an API
 * fetch first. A spinner with no explanation reads as a hang, so the button
 * says which stage it is on.
 */
function Submit({ handle }: { handle: string }) {
  const { pending } = useFormStatus();
  const ready = handle.trim().length > 0 && isValidHandleInput(handle);

  return (
    <button
      type="submit"
      className="btn-primary w-full sm:w-auto"
      disabled={pending || !ready}
    >
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-accent-fg/30 border-t-accent-fg" />
          Reading the voice…
        </>
      ) : (
        "Write drafts"
      )}
    </button>
  );
}

export function GenerateForm({
  action,
  demoHandles,
}: {
  action: (state: GenerateState, formData: FormData) => Promise<GenerateState>;
  demoHandles: string[];
}) {
  const [state, formAction] = useActionState(action, { error: null });
  // All three are controlled for the same reason: the action result re-renders
  // this form, and an uncontrolled input resets to empty. Losing the topic you
  // typed because you hit the rate limit is a small thing that feels broken.
  const [handle, setHandle] = useState("");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState("5");

  const touched = handle.trim().length > 0;
  const malformed = touched && !isValidHandleInput(handle);

  return (
    <form action={formAction} className="card p-5 sm:p-6">
      <div>
        <label className="label" htmlFor="handle">
          X handle
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[15px] text-subtle">
            @
          </span>
          <input
            id="handle"
            name="handle"
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            placeholder="naval"
            className="field pl-7"
            aria-invalid={malformed}
          />
        </div>
        <p className="mt-1.5 h-4 text-[12px] text-subtle">
          {malformed
            ? "Handles are up to 15 letters, numbers or underscores."
            : "A handle, or a link to their profile."}
        </p>
      </div>

      {demoHandles.length > 0 ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-subtle">Try:</span>
          {demoHandles.map((demo) => (
            <button
              key={demo}
              type="button"
              onClick={() => setHandle(demo)}
              className="rounded-md border border-border bg-surface-2 px-2 py-0.5 text-[12px] text-muted transition-colors hover:border-border-strong hover:text-fg"
            >
              @{demo}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_7rem]">
        <div>
          <label className="label" htmlFor="topic">
            Topic <span className="font-normal text-subtle">— optional</span>
          </label>
          <input
            id="topic"
            name="topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            maxLength={200}
            autoComplete="off"
            placeholder="e.g. hiring, or why deadlines slip"
            className="field"
          />
        </div>

        <div>
          <label className="label" htmlFor="count">
            Drafts
          </label>
          <select
            id="count"
            name="count"
            value={count}
            onChange={(event) => setCount(event.target.value)}
            className="field"
          >
            {[3, 4, 5, 6, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="mt-5 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[13px] leading-relaxed text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="hidden text-[12px] leading-relaxed text-subtle sm:block">
          Takes ten to twenty seconds.
        </p>
        <Submit handle={handle} />
      </div>
    </form>
  );
}
