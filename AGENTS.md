# Minds 2.0 — Agent Onboarding (read this first)

You are working on **Minds 2.0**: the rebuilt Minds social network, running as a **Recursiv app**. This doc gets you productive fast and — critically — tells you **what's already built so you don't redo or break it.** Read the "Already done — DO NOT repeat" section before touching discovery, chat, auth, or the legacy import.

## What this is (30 seconds)
- **Client:** this repo — Expo / React Native + **NativeWind** (Tailwind). Ships to web + native. Web deploys to **https://minds.on.recursiv.io**.
- **Backend:** the **Recursiv platform** (separate monorepo at `~/recursiv`). The app talks to it ONLY through **`@recursiv/sdk`** (`lib/recursiv.ts`) — never raw `fetch` to the API. API host: `https://api.minds.recursiv.io`.
- **Data lives in Recursiv's shared multi-tenant Postgres (Neon)**, scoped to the Minds tenant. The app does NOT own a database; the platform does.
- **Minds is one of ~17 co-resident tenants.** Everything is scoped by these IDs — memorize them:
  - `MINDS_NETWORK_ID = 0f1fcb0f-11c0-41f2-9406-943a88f48b59`
  - `MINDS_PROJECT_ID = 019d5190-f0c0-717e-a1bd-ef9c335292b9`
  - `MINDS_ORG_ID     = 019d517b-bb87-744d-92db-b3801dc15927`
- The app's API key is **project-bound** to MINDS_PROJECT, so the server auto-scopes queries to Minds. **Never write a query/endpoint that returns cross-tenant data** (see Footguns).

## Repo layout
- `app/` — Expo Router routes. `app/(tabs)/index.tsx` = the **Feed screen** (For You / Following). `app/(tabs)/discover/` = the **Discover search console**. `app/(tabs)/chat.tsx` = chat. `app/(tabs)/admin.tsx` = admin panel. `app/+html.tsx` = the web HTML shell (OG/meta tags live here).
- `lib/` — the brains. `recursiv.ts` (SDK client), `auth.tsx` (OTP auth + API-key minting), `hooks.ts` (data hooks — `usePosts`, `useDiscoverPosts`, `useProfiles`, `useCommunities`, `useAgents`, `useProfileLeaderboard`), `discover.tsx` (discovery UI helpers + ranking math), `chatEvents.ts` (local real-time chat channel), `referral.ts` (invite links), `resolvePersonalAgent.ts` (cached agent lookup).
- `components/` — `PostCard.tsx`, `FeedSidebar.tsx` (web right-rail "popular" widgets), `ChatBubble.tsx`, `MediaViewer.tsx` / `VideoPlayer.tsx`, `Badge.tsx`.
- `constants/theme.ts` — design tokens. Brand accent is **gold** (`#d4a844` dark / `#a07e24` light). Don't hardcode colors.

## The Discovery system (the big build — understand before touching)
Minds discovery is an X-style engine. **One ranking brain drives For You, Discover, and the sidebar widgets.** It reduces to: *represent every post as a vector, rank by un-gameable engagement + personal relevance, keep it fresh.*

- **Embeddings (pgvector).** Every post has a 768-d `post.embedding` (OpenAI `text-embedding-3-small` via OpenRouter). Powers semantic search, "more like this", topic clustering, and For You personalization. Server: `packages/server/src/features/curator/embeddings.ts`; backfill `scripts/discovery/embed-posts.ts`.
- **Engagement quality = votes + UNIQUE COMMENTERS + velocity** (un-gameable; one spammer can't fake distinct repliers). Computed in `ForYouRanker.ts` + the `/posts` serializers.
- **For You** (`packages/server/.../curator/ForYouRanker.ts`): weighted blend of engagement, recency, **social (follows — the warm-start)**, velocity, and **embedding affinity** (cosine to the viewer's upvoted posts). **Follows carry cold-start** (weight 1.5), not legacy votes.
- **Topics (40, emergent).** Derived by k-means over embeddings (`scripts/discovery/cluster-topics.ts`), labeled by an LLM (`relabel-topics.ts`) — NOT hand-picked. Stored as `tag` rows with `description='auto-topic'` + `post_tag`. Centroids in `scripts/discovery/topic-centroids.json`; `topicClassifier.ts` assigns new posts.
- **Semantic search + "more like this":** `GET /posts/semantic-search`, `GET /posts/:id/similar` (kNN over the HNSW cosine index; FTS fallback).
- **Freshness / seen-exclusion:** the ranker down-ranks posts the viewer already saw (off `view` signals).
- **Discover UI:** `app/(tabs)/discover/` — entity tabs (Posts/People/Communities/Agents) → topic bar (default All) → Sort dropdown (default **Top**) + Time dropdown (default **This Week**). Search box does FTS/semantic.
- **Sidebar widgets** (`FeedSidebar.tsx`): popular Posts (Hot)/People (engagement leaderboard)/Communities (activity)/Agents — all use the SAME ranking as Discover.

## Chat (reliability + real-time)
- Real-time via **socket.io** (server `WebSocketService`). Client: `app/(tabs)/chat.tsx`, `components/SideNav.tsx` (inbox), `lib/chatEvents.ts` (a local pub/sub so the sidebar updates on the same tick as an optimistic send), `lib/realtime.ts`.
- **Optimistic send** with pending/failed + tap-to-retry (`ChatBubble.tsx`). New DMs appear instantly in thread + sidebar; unread badges + last-message previews update live.
- **CRITICAL:** the app once self-DDoSed into HTTP 429 ("rate limit exceeded") because `resolvePersonalAgent` / `/agents?limit=100` were fetched uncached from ~6 mount sites and `fetchWithRetry` amplified 429s. **Fix is in place** (`lib/resolvePersonalAgent.ts` caches + dedupes via a shared in-flight promise; `lib/agentIntro.ts` deduped). **Do not reintroduce un-deduped mount-time fetches.**

## Auth (multi-network OTP)
- Email **OTP** only (no passwords). `lib/auth.tsx` mints a **project-scoped API key** on login.
- A person can have a `user` row per network (unique on `(network_id, email)`). The Minds app resolves the user **scoped to the Minds network** via the `x-recursiv-app-project` header the SDK sends (server: `apps/api/authRoutes.ts` + `packages/server/src/auth/index.ts` `createNetworkScopedDrizzleAdapter`). So jack@minds.com on this app → the Minds-network account.
- **API_KEY_SCOPES** in `lib/auth.tsx`: clients request scopes optimistically incl. `'admin'`; the server **strips** `admin` for non-admins (doesn't 403). **Never bump `@recursiv/sdk` ahead of the deployed API** — a coupled header (`x-recursiv-app-project`) once broke ALL login when the API's CORS allow-list lagged. Bump SDK + API together, and smoke-test login.

## Legacy import + content recovery (data provenance)
- The Minds content was imported from legacy Minds (read-only). Scripts in `~/recursiv/scripts/legacy-import/`; importer `~/recursiv/packages/server/src/features/legacy-import/`. Idempotent on `(network_id, legacy_guid)`, reversible by `import_batch_id`, provenance via `import_source='legacy_minds'`.
- **Content recovery (done):** the v3 importer originally kept only `message` + built media URLs from the wrong (activity) GUID. A recovery pass backfilled ~36k "blank" posts (reminds/blog/image) from `remind_object`/`blurb`/`title` and rebuilt `post_media.url` from the IMAGE guid in `custom_data`. Reversible (`recovery_backfill_log`).
- Full cutover plan (data preservation, OCI/Cloudflare scale-down, legacy tenants): `~/.claude/plans/minds-cutover-plan.md`.

## Deploy
- **This app (minds-app):** push to `main`, then deploy via the Recursiv MCP `deploy_project` (project `019d5190-…`). The build host is **flaky** (timeouts/disk) — if a deploy hangs >30min it's stuck; cancel it (`cancel_deployment`) and redeploy. Never touch Coolify directly.
- **Recursiv API:** deploy ONLY via the `promote-to-prod.yml` GH Action (health-gated). Verify live commit at `https://api.minds.recursiv.io/health`. Build host is flaky here too — retry. (Heads-up: the `/check-runs` API sometimes returns a phantom in-progress build-test even after `ci.yml` is green — trust the `ci.yml` run conclusion.)

## Footguns (real, learned the hard way)
1. **Cross-tenant leaks.** Always scope by network (and project for project-bound keys). Recently-fixed leaks: `/profiles/leaderboard`, `/agents/discoverable`, `/agents/leaderboard` were network-only → leaked other tenants. RLS is the planned backstop; until then, app-code scoping is load-bearing.
2. **camelCase/snake_case param bug.** Client sends camelCase, some REST handlers read snake_case → param silently dropped. Check both sides when a filter "does nothing".
3. **Drizzle journal gotcha.** Several discovery columns (`embedding`, `ai_caption`) + indexes were added via **raw SQL migrations NOT in the drizzle journal** (`~/recursiv/drizzle/0014-0016`). The journal-based migrator (incl. the **test DB**) won't create them → tsc/test failures if schema.ts references them without the column existing everywhere. Keep schema.ts and the actual columns in sync across prod + test.
4. **OpenRouter rate limits.** The embeddings/vision backfills hammer one key → 429 or 200-with-error-body. Backfill scripts now have retry/backoff; don't run multiple heavy backfills in parallel (also exhausts the Neon connection pool).
5. **CORS-as-symptom.** A 5xx or a blocked header shows up in the browser as a "CORS error"/"failed to fetch" even when the API is healthy. Check the actual response.
6. **Media:** legacy media URLs need the correct IMAGE guid + are being migrated to R2/Bunny (separate workstream). Don't assume a `post_media.url` is fetchable; ~1.3k legacy images are genuinely gone.

## ✅ Already done — DO NOT repeat (Jun 2026 build)
Built, deployed, and live unless noted. **Don't rebuild these:**
- Full discovery engine: embeddings, semantic search, "more like this", 40 emergent LLM-labeled topics, For You personalization (follows warm-start + taste vectors), seen-exclusion freshness, engagement-quality ranking.
- Discover UI redesign (entity tabs → topic bar → Sort/Time dropdowns; defaults Top + This Week).
- Sidebar "popular" widgets unified onto the discovery ranking.
- Feed quality: dedup reposts from discovery, filter blank posts, hide auto-topic tags on post cards, cross-tenant scope fixes, FTS keyword search fix.
- Chat reliability/real-time: 429-storm fix (caching/dedup), optimistic send + tap-to-retry, live sidebar sync, unread/preview.
- Multi-network OTP login (VIP accounts jack@/bill@minds.com resolve to the Minds-network account); admin-scope strip fix; jack/bill are admins.
- Media: left-justified, no letterbox; legacy media URLs fixed (display again).
- Legacy content recovery (~36k blank posts → real content; ~31k media URLs fixed); embeddings + captioning backfills.
- Invite/referral link + OG unfurl image (`app/+html.tsx`, `public/og-invite.png`).

## Roadmap / what's NOT done yet (next phases)
Monetization (tiers + BYOK Stripe + metered AI), token economy (burn + boost auction), video→Bunny migration, content-supply agents (Digg-style external content), moderation ladder, the full 1.5M cutover, federation, data-layer scaling. See `~/.claude/plans/operation-keystone.md` + `~/.claude/plans/minds-cutover-plan.md`.

## Working norms
- Use `@recursiv/sdk` for all API calls. Use NativeWind + `constants/theme.ts` tokens. Keep features self-contained.
- Run `npx tsc --noEmit -p tsconfig.json` before pushing. The Recursiv server: `pnpm --filter @recursiv/server exec tsc --noEmit`.
- Scope every query to the Minds tenant. When in doubt about a primitive (user/org/project/membership), read `~/recursiv/packages/server/src/db/CLAUDE.md`.
