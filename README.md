# Mockingbird

Give it an X handle. It reads how that person writes, then drafts new posts in their voice.

**Live:** _(deploying — URL goes here)_

---

## What it does

You sign in, type a handle, and optionally give it a topic.
It fetches that person's recent original posts, works out how they write, and returns five new drafts you can copy or open straight into X's compose box.
Every generation is saved to your account, so the history is yours and nobody else's.

It writes drafts.
It never posts anything, and it never asks for your X credentials.

## How it works

```
handle → normalise → corpus (cached 24h) → voice profile (cached) → drafts → validate → Postgres
```

1. **Normalise.** `@paulg`, `paulg`, `x.com/paulg/status/123` all resolve to `paulg`, and anything that isn't 1–15 characters of `[A-Za-z0-9_]` is rejected before a request leaves the server.
2. **Corpus.** Up to 40 recent original posts — replies and retweets dropped, trailing `t.co` media links stripped, near-duplicates removed, anything under 40 characters discarded as a reaction rather than writing.
3. **Voice profile.** One model call produces a structured description of *how* they write: cadence, punctuation, capitalisation, emoji and hashtag habits, recurring topics, and an explicit list of things they never do.
4. **Drafts.** A second call writes new posts from that profile plus 15 real examples for calibration.
5. **Validate.** Anything over 280 characters, duplicated within the batch, or too close to a real post is thrown away before it reaches the database.

## The decisions, and why

### Getting the tweets is the actual problem

X moved every new developer onto pay-per-use in February 2026.
There is no free tier, no Basic plan to sign up for, and reads cost $0.005 each — about **$0.25 per handle** at the corpus size this needs.
The unauthenticated `syndication.twitter.com` timeline endpoint still exists, but it answered HTTP 429 on the first probe from my machine, and Vercel's shared egress IPs would do worse.

So the data comes from **twitterapi.io** at $0.15 per 1,000 tweets — the same posts, about 33× cheaper.
Three things make that dependency safe to build on:

- **A 24-hour cache in Postgres.** A handle is fetched once a day at most, however many people ask for it. The badge on each result says `live`, `cached · 3h ago`, or `sample data`, so you always know which you got.
- **Committed fixtures.** Two handles have their real posts captured into `src/lib/x/fixtures/`. If the API key runs dry or the service is down, those still generate, and the UI labels them honestly as sample data rather than passing them off as a live read.
- **One file to swap.** `src/lib/x/fetch.ts` is the only module that knows twitterapi.io exists. Moving to the official X API is a rewrite of that file and nothing else.

There is no provider abstraction layer, no interface with one implementation.
There's one provider today; when there are two, that's when an interface earns its place.

A quirk worth recording, because it shaped the code: **twitterapi.io intermittently returns an empty first page for a valid, public handle**, then 20 tweets on an identical request a second later.
I hit this while capturing fixtures. Without a retry the user is told the account has no posts, which is a lie — so `fetchRecentTweets` retries an empty first page exactly once.

### Generation is two stages, not one

The obvious build is to put 40 tweets in a prompt and ask for five more.
That produces pastiche, and it regurgitates the source posts constantly.

Splitting it into **analyse, then write** fixes both, and buys three other things:

- The voice profile is **cacheable**, keyed on a hash of the corpus. A handle costs one analysis call ever, until they post something new. Generating again is one call, not two.
- It is **inspectable**. The result page shows the whole profile — so when a draft misses, you can see whether the model misread the voice or just wrote a bad post. That's the difference between a product and a demo.
- It is **debuggable**. `npm run dry-run -- msinghal34 "deadlines"` runs both stages against a fixture with no database and prints the profile, the drafts, and what validation rejected. That's how the prompts were iterated.

### Drafts that copy the source are thrown away, not shown

The point of the product is *new* posts.
A model asked to imitate a voice will happily hand back a reworded version of a tweet it was shown, and that looks impressive until you check.

So every draft is scored against every source post by character-trigram overlap, asymmetric (share of the *draft's* trigrams found in the source, so a short draft lifted from a long tweet still scores high).
Above 0.7 it is discarded.
The threshold was set by eye against real output: paraphrases land at 0.75–0.95, genuinely new posts on familiar themes stay under 0.5.

If that leaves fewer drafts than you asked for, it makes **one** more attempt, with the already-accepted drafts added to the "don't repeat this" set, and then stops.
A model that can't stop paraphrasing won't be talked round on the third try, and four good drafts beat five with a copy in them.

### Auth: Auth.js, credentials, no adapter

Email and password, which is the least friction for someone reviewing this — no OAuth app to trust, no inbox to check.

Auth.js v5 with a credentials provider, JWT sessions, and **no database adapter**.
A credentials provider requires the JWT strategy anyway, so an adapter would add three tables nothing reads.
The `users` table is mine, written by the sign-up action.

Passwords use **scrypt from `node:crypto`**, not bcryptjs.
bcryptjs is pure JavaScript, so a cost-12 hash burns over a second of function time on every sign-in; Node's scrypt is native, memory-hard, already in the standard library, and measured 400ms locally at the OWASP baseline (N=2¹⁷, r=8, p=1).
Same security property, a fraction of the latency, one fewer dependency.
Hashes are stored as `scrypt$N$r$p$salt$hash` so the cost can be raised later without invalidating anyone's password.

Sign-in verifies against a real dummy hash when the address is unknown, so response time doesn't reveal whether an account exists, and the error message is identical either way.

Route protection is a check in `src/app/app/layout.tsx` rather than middleware.
Middleware runs on the edge runtime, which would mean splitting the Auth.js config in two to keep `node:crypto` out of it — machinery in exchange for nothing here.
Every server action calls `requireUser()` on its own, and `getGeneration()` scopes to the owner **in the query** rather than checking after loading, so there is no path where a row is fetched and then forgotten about.

### Postgres on Neon, through Vercel

SQLite is out for anything deployed to Vercel: the filesystem is ephemeral per invocation, so the file would vanish between requests.

Neon, provisioned with `vercel install neon`, so there's one account instead of two and `DATABASE_URL` is injected into the project automatically.
Access is Drizzle over `@neondatabase/serverless` — the HTTP driver, so every query is a stateless round-trip and a burst of functions can't exhaust a connection pool that nothing is around to keep.

Migrations are plain SQL in `drizzle/`, applied by hand with `npm run db:migrate`.
Not on deploy: a migration that runs during a build is a good way to get a half-applied schema with no obvious owner.

### Next.js 15.5, not 16

Auth.js v5 is still beta, and Next 16 renamed `middleware.ts` to `proxy.ts` and has open peer-dependency and typing friction with it.
15.5 is the combination Auth.js actually documents, and nothing here needs anything 16 added.
This is the one place I chose the boring version on purpose.

### Gemini 3.8 Flash

Free tier, 15 requests/minute, 1,500/day, no card — so the live demo stays up indefinitely at zero cost, which matters more for a take-home than the last few points of quality.
The model id is pinned rather than `gemini-flash-latest`, and recorded on every generation row along with a prompt version, so an old result stays interpretable after the prompts change.

Both keys are read only inside modules marked `import "server-only"`, and every call happens in a server action.
Nothing but finished text ever reaches the browser.

### Rate limiting

20 generations per user per hour, counted straight off the `generations` table.
For a take-home, adding Redis to count to twenty would be worse engineering than one indexed `COUNT(*)`.

## Running it locally

```bash
npm install
cp .env.example .env.local     # fill in the four values
npm run db:migrate
npm run dev
```

`DATABASE_URL` is any Postgres.
`GEMINI_API_KEY` is free from [AI Studio](https://aistudio.google.com/apikey).
`TWITTERAPI_IO_KEY` is optional — without it, the two fixture handles still work and everything else reports that it can't fetch.

```bash
npm test                              # unit tests
npm run typecheck                     # tsc --noEmit
npm run lint
npm run dry-run -- msinghal34 "x"     # pipeline against a fixture, no DB, no writes
./scripts/capture-fixture.sh <handle> # record a new fixture
```

## Tests

Unit tests cover the parts where being wrong is quiet rather than loud: handle normalisation, corpus cleaning and hashing, the twitterapi.io response parser against a recorded payload, and the draft validator including the copy detector.

There are no tests against a live database or a live model.
Both are someone else's service, and a test that fails when their API is slow is a test people learn to ignore.

## What I'd do with more time

- **Stream the drafts** as they generate, instead of a 10–20 second spinner.
- **Regenerate one draft** without redoing the batch.
- **Embeddings for the copy check.** Trigram overlap catches rewording; it doesn't catch the same idea in new words.
- **Thread support** — several of the fixture posts are thread openers, and drafting a whole thread is the obvious next feature.
- **Let users correct the voice profile** and regenerate from the edit. It's already a structured, visible artifact; making it editable is a small change with a large effect on output.
- **A real rate limiter** if this ever had more than one user.

## Cost, end to end

| | |
| --- | --- |
| Hosting | $0 (Vercel Hobby) |
| Database | $0 (Neon free tier, scales to zero) |
| LLM | $0 (Gemini free tier) |
| Tweets | ~$0.006 per handle, once a day, then cached |
