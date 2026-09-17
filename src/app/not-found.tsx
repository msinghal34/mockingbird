import Link from "next/link";

import { Wordmark } from "@/components/brand";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <Wordmark />
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted">
        This page doesn&apos;t exist, or it belongs to someone else&apos;s
        account. Generations are private to the person who made them.
      </p>
      <div className="mt-6">
        <Link href="/app" className="btn-primary">
          Back to the app
        </Link>
      </div>
    </div>
  );
}
