import type { RawTweet } from "./fetch";

import fatimarizwan from "./fixtures/fatimarizwan.json";
import msinghal34 from "./fixtures/msinghal34.json";

export type Fixture = {
  handle: string;
  capturedAt: string;
  tweets: RawTweet[];
};

/**
 * Real posts, captured once with scripts/capture-fixture.sh and committed.
 *
 * These are the safety net for the live demo: twitterapi.io is a third party
 * on a prepaid balance, and a reviewer opening the URL after the credit runs
 * out should still see the product work. Anything served from here is labelled
 * as sample data in the UI — the app never passes a fixture off as a live read.
 *
 * A static map rather than a directory read, so the JSON is traced into the
 * serverless bundle at build time.
 */
const FIXTURES: Record<string, Fixture> = {
  fatimarizwan: fatimarizwan as Fixture,
  msinghal34: msinghal34 as Fixture,
};

export function fixtureFor(handle: string): Fixture | null {
  return FIXTURES[handle.toLowerCase()] ?? null;
}

/** Offered on the form as one-click examples. */
export const DEMO_HANDLES = Object.keys(FIXTURES).sort();
