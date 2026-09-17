import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { Logo, Wordmark } from "@/components/brand";

const STEPS = [
  {
    title: "Read the timeline",
    body: "We pull their recent original posts — no replies, no retweets — and cache them, so the same handle is never fetched twice in a day.",
  },
  {
    title: "Profile the voice",
    body: "A first model pass describes how they write: cadence, punctuation, capitalisation, what they never do. You can read the whole profile.",
  },
  {
    title: "Write new posts",
    body: "A second pass writes from that profile. Anything that comes back as a reworded version of a real post is thrown away, not shown to you.",
  },
];

export default async function LandingPage() {
  if (await auth()) redirect("/app");

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Link href="/sign-in" className="btn-ghost px-3 py-1.5 text-[13px]">
            Sign in
          </Link>
          <Link href="/sign-up" className="btn-primary px-3.5 py-1.5 text-[13px]">
            Get started
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 sm:py-28">
          <Logo className="h-10 w-10 text-accent" />
          <h1 className="mt-6 max-w-2xl text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Give it an X handle.
            <br />
            Get posts in their voice.
          </h1>
          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted">
            Mockingbird reads how someone actually writes — the rhythm, the
            punctuation, the things they never do — and drafts new posts from
            that. Not their old posts rearranged. New ones.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/sign-up" className="btn-primary">
              Try it
            </Link>
            <Link href="/sign-in" className="btn-ghost">
              I have an account
            </Link>
          </div>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="text-[13px] font-medium tracking-wide text-subtle uppercase">
            How it works
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card p-5">
                <span className="font-mono text-[11px] text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-2.5 text-[15px] font-medium">{step.title}</h3>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-t border-border py-16">
          <h2 className="text-[13px] font-medium tracking-wide text-subtle uppercase">
            A note on what this is
          </h2>
          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-muted">
            This writes drafts, not posts. Nothing is published anywhere — you
            copy what you want and decide what to do with it. It is meant for
            writing in your own voice, or for seeing how the trick works. It is
            not meant for passing work off as someone else&apos;s.
          </p>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl border-t border-border px-6 py-8 text-[13px] text-subtle">
        Built as a take-home.{" "}
        <a
          href="https://github.com/msinghal34/mockingbird"
          target="_blank"
          rel="noreferrer noopener"
          className="text-muted underline underline-offset-2 transition-colors hover:text-fg"
        >
          The source and the README
        </a>{" "}
        explain every decision in it.
      </footer>
    </div>
  );
}
