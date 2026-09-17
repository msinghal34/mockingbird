import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {/* A bird mid-call: body, wing, beak. */}
      <path
        d="M4.2 14.6c0-4.3 3.1-7.6 7.1-7.6 2.2 0 3.6.9 4.5 2l3.9-1.6-1.4 3.2 1.5 1.1-2.2.8c-.3 4-3.4 6.9-7.4 6.9-3.2 0-5.4-1.6-6.4-3.3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.4 14.1c1.6.5 3.4.3 4.9-.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="14.6" cy="10.6" r="0.95" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-fg transition-opacity hover:opacity-80"
    >
      <Logo className="h-5 w-5 text-accent" />
      <span className="text-[15px] font-semibold tracking-tight">Mockingbird</span>
    </Link>
  );
}
