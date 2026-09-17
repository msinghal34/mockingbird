#!/usr/bin/env bash
# Capture a handle's recent posts from twitterapi.io into a committed fixture.
#
# Fixtures exist so the deployed demo keeps working when the API key runs out
# of credit or twitterapi.io is down. They are captured once, by hand, and the
# app labels anything served from them as sample data rather than pretending it
# fetched live.
#
#   ./scripts/capture-fixture.sh msinghal34
#
# Deliberately not a TypeScript script reusing src/lib/x/fetch.ts: that module
# is `server-only`, and bending it to also run outside Next costs more than the
# few lines of curl below.
set -euo pipefail

handle="${1:?usage: capture-fixture.sh <handle>}"
pages="${2:-4}"

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck disable=SC1091
set -a && . "$root/.env.local" && set +a

out="$root/src/lib/x/fixtures/${handle,,}.json"
mkdir -p "$(dirname "$out")"

cursor=""
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

for ((page = 0; page < pages; page++)); do
  url="https://api.twitterapi.io/twitter/user/last_tweets?userName=${handle}&includeReplies=false"
  [[ -n "$cursor" ]] && url+="&cursor=${cursor}"

  curl -sS -m 30 -H "X-API-Key: ${TWITTERAPI_IO_KEY}" "$url" -o "$tmp/page${page}.json"

  cursor="$(node -e '
    const j = require(process.argv[1]);
    if (j.status && j.status !== "success") { console.error(j.msg); process.exit(1); }
    const tweets = (j.data && j.data.tweets) || j.tweets || [];
    process.stderr.write(`page: ${tweets.length} tweets\n`);
    process.stdout.write(tweets.length && j.has_next_page ? (j.next_cursor || "") : "");
  ' "$tmp/page${page}.json")"

  [[ -z "$cursor" ]] && break
done

node -e '
const fs = require("node:fs");
const [handle, dir, out] = process.argv.slice(1);

const tweets = fs.readdirSync(dir).sort()
  .flatMap((f) => {
    const j = JSON.parse(fs.readFileSync(`${dir}/${f}`, "utf8"));
    return (j.data && j.data.tweets) || j.tweets || [];
  });

// Keep only the fields src/lib/x/fetch.ts reads. The raw payload carries ~35
// fields per tweet, most of them noise in a file meant to be reviewed in a diff.
const slim = tweets.map((t) => ({
  id: t.id,
  text: t.text,
  url: t.url ?? null,
  createdAt: t.createdAt ?? null,
  likeCount: t.likeCount ?? 0,
  retweetCount: t.retweetCount ?? 0,
  isReply: Boolean(t.isReply),
  retweeted_tweet: t.retweeted_tweet ? true : null,
  author: t.author
    ? {
        userName: t.author.userName,
        name: t.author.name ?? null,
        profilePicture: t.author.profilePicture ?? null,
        description: t.author.description ?? null,
        followers: t.author.followers ?? null,
      }
    : null,
}));

const seen = new Set();
const unique = slim.filter((t) => !seen.has(t.id) && seen.add(t.id));

fs.writeFileSync(out, JSON.stringify({
  handle: handle.toLowerCase(),
  capturedAt: new Date().toISOString().slice(0, 10),
  tweets: unique,
}, null, 2) + "\n");

console.log(`${out}: ${unique.length} tweets`);
' "$handle" "$tmp" "$out"
