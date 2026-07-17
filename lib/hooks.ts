import * as React from 'react';
import { useAuth } from './auth';
import { ORG_ID } from './recursiv';
import { getCached, setCache, isFresh, invalidatePrefix, subscribeToInvalidations, fetchDeduped } from './cache';
import { filterMuted } from './muted';
import { loadPreferences, markCuratedNow } from './onboarding';
import { buildCuratorRequest } from './curator';
import { getPreference } from './preferences';
import { captureException } from './monitoring';
import { dedupePosts } from './models';

// Once-per-session guard for the personal-agent config upsert (see recurate).
const ensuredPersonalThisSession = false;

/**
 * Fetch posts from the feed.
 * All calls scoped to the Minds org.
 */
export function usePosts(sort: 'score' | 'latest' | 'following' | 'personal' = 'latest', limit = 20) {
  const { sdk, user } = useAuth();
  const cacheKey = `posts:${sort}:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const offsetRef = React.useRef(0);
  const followingIdsRef = React.useRef<Set<string> | null>(null);
  const myCommunityIdsRef = React.useRef<Set<string> | null>(null);
  // Concurrency control. Without these, every onEndReached tick near the
  // bottom fired another identical page fetch while one was in flight, a
  // focus-refresh racing a loadMore corrupted the shared offset (silently
  // skipping pages), and errors retried instantly on every scroll frame —
  // client load scaled inversely with backend health.
  const reqIdRef = React.useRef(0);
  const inFlightRef = React.useRef(false);
  const failuresRef = React.useRef(0);
  const cooldownUntilRef = React.useRef(0);

  const fetchPosts = React.useCallback(async (refresh = false, silent = false) => {
    if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
    const s = sdk;
    if (!s) return;
    // Appends never overlap (same offset twice); a refresh supersedes
    // whatever is running instead of racing it.
    if (inFlightRef.current && !refresh) return;
    const myReq = ++reqIdRef.current;
    inFlightRef.current = true;
    // A superseded request must not commit state or advance the offset.
    const stale = () => reqIdRef.current !== myReq;
    try {
      if (refresh) {
        if (!silent) setRefreshing(true);
        offsetRef.current = 0;
      }

      // The Following feed is now served by the server's follow-graph path
      // (following=true → posts from everyone you follow, network-scoped,
      // reverse-chron, reposts included). The old client-side approach fetched
      // the follow set (capped at 500) and filtered locally, which both missed
      // followees beyond the cap and broke entirely for imported/multi-network
      // accounts whose followees' posts are org_id NULL. No local follow set
      // needed anymore.

      // Load user's communities for personalized "For You" feed
      if (sort === 'score' && user?.id && !myCommunityIdsRef.current) {
        try {
          const commRes = await s.communities.list({ limit: 100, organization_id: ORG_ID || undefined } as any);
          const joined = (commRes.data || []).filter((c: any) => c.is_member || c.isMember);
          myCommunityIdsRef.current = new Set(joined.map((c: any) => c.id));
        } catch {
          myCommunityIdsRef.current = new Set();
        }
      }

      // 'personal' (For You) is now served by the server-side recommender
      // (sdk.curator.forYou — a cheap, LLM-free ranking of existing app posts),
      // NOT the old per-user agent brief. It needs no audience/org param (the
      // key's project scope drives it). Other sorts page the shared post list.
      const baseParams: Record<string, any> = { limit };
      // Imported legacy posts are project-scoped with org_id NULL. Org-scoping
      // the discovery/trending fetch ('score') hides them, leaving only the few
      // native org posts (looked like "all one user"). Network scope includes
      // the imported content. The 'following' feed is ALSO network-scoped: it is
      // a raw reverse-chron stream of everyone the user follows (served by the
      // server's follow-graph path), and a followed author's imported posts have
      // org_id NULL — org-scoping the fetch would hide them, leaving the feed
      // empty for imported/multi-network accounts. Other sorts keep org scope.
      if (ORG_ID && sort !== 'score' && sort !== 'following') {
        baseParams.organization_id = ORG_ID;
      }
      // Server-authoritative Following feed: the server filters to the caller's
      // follow graph (network-scoped, reverse-chron, reposts included). The
      // client-side follow filter below stays as a harmless secondary pass.
      if (sort === 'following') {
        baseParams.following = 'true';
      }
      // Server-side engagement ordering for discovery/trending, so high-voted
      // imported posts surface instead of only the most-recent (which one active
      // user can dominate). Client still re-sorts for the joined-community boost.
      if (sort === 'score') {
        baseParams.sort = 'score';
      }

      // Client-side filters (followed authors, muted users) can wipe out an
      // entire server page, so pagination must be tracked in RAW server rows:
      // advancing the offset by the filtered count refetches the same rows
      // forever once a page filters to zero, and deriving hasMore from the
      // filtered count truncates the feed after any heavily-filtered page.
      // When a page filters to nothing, keep pulling (bounded) so the user
      // never sees an empty append while posts remain.
      const baseOffset = refresh ? 0 : offsetRef.current;
      let rawCount = 0;
      let more = true;
      let data: any[] = [];
      for (let page = 0; page < 5 && more; page++) {
        const pageOffset = baseOffset + rawCount;
        const res: any = await fetchDeduped(`req:${cacheKey}:${pageOffset}`, () =>
          sort === 'personal' && typeof (s as any).curator?.forYou === 'function'
            // For You → the server-side recommender (ranks existing posts;
            // returns the same shape as posts.list, so the rest is unchanged).
            // Guard: if the deployed SDK predates forYou, fall back to the
            // org-scoped post list so the feed degrades gracefully (no crash).
            ? (s as any).curator.forYou({ limit, offset: pageOffset })
            : s.posts.list({ ...baseParams, offset: pageOffset } as any));
        const raw = res.data || [];
        rawCount += raw.length;
        more = res.meta?.has_more ?? raw.length >= limit;
        let visible = raw;
        // The server's follow-graph path (following=true) is authoritative and
        // already returns only followed authors' posts — and it covers the FULL
        // follow graph, not the client's 500-cap sample. Re-applying the
        // client-side follow filter here would wrongly DROP posts from followees
        // beyond that 500-cap (jack follows ~3k). So skip it for 'following'.
        // (followingIdsRef is still fetched for other uses; harmless if unused.)
        visible = filterMuted(visible);
        data = data.concat(visible);
        if (data.length > 0 || raw.length === 0 || stale()) break;
      }
      if (stale()) return;

      // Collapse reposts of the same original (and orphaned legacy reminds that
      // share one image with no reposted_from link) so a single viral post /
      // remind chain doesn't fill discovery/trending. Shared helper normalizes
      // the media URL (strips query string / trailing slash) so CDN variants of
      // the same image collapse — the old inline key matched the raw first-media
      // URL and let cache-busted dups (the "john Untitled" noise) slip through.
      data = dedupePosts(data);

      if (sort === 'score') {
        // Boost posts from communities the user has joined
        const myComms = myCommunityIdsRef.current;
        data = [...data].sort((a: any, b: any) => {
          const aBoost = myComms?.has(a.community_id) ? 5 : 0;
          const bBoost = myComms?.has(b.community_id) ? 5 : 0;
          return ((b.score || 0) + bBoost) - ((a.score || 0) + aBoost);
        });
      } else if (sort === 'latest') {
        data = [...data].sort((a: any, b: any) =>
          new Date(b.createdAt || b.created_at || 0).getTime() -
          new Date(a.createdAt || a.created_at || 0).getTime()
        );
      }

      // Pre-cache individual posts
      data.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });

      if (refresh) {
        setPosts(data);
        setCache(cacheKey, data);
      } else {
        setPosts(prev => {
          // Deduplicate by ID
          const seen = new Set(prev.map((p: any) => p.id));
          const newOnly = data.filter((p: any) => !seen.has(p.id));
          const merged = [...prev, ...newOnly];
          setCache(cacheKey, merged);
          return merged;
        });
      }
      setHasMore(more);
      offsetRef.current = baseOffset + rawCount;
      failuresRef.current = 0;
      cooldownUntilRef.current = 0;
    } catch (err: any) {
      captureException(err, { hook: 'usePosts', sort });
      if (!stale()) {
        setError(err.message || 'Failed to load posts');
        // Exponential cooldown (2s → 4s → … → 30s cap) so a degraded API
        // isn't hammered by every scroll tick near the bottom of the feed.
        failuresRef.current += 1;
        cooldownUntilRef.current = Date.now() + Math.min(2000 * 2 ** (failuresRef.current - 1), 30_000);
      }
    } finally {
      if (!stale()) {
        inFlightRef.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [sdk, sort, limit, user?.id, cacheKey]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) {
      // Even when the cache is fresh, state must swap to THIS sort's data —
      // early-returning without setPosts left the previous tab's posts
      // rendered under the new tab until the TTL lapsed. Pagination refs
      // belong to the old sort too, so reset them or the next loadMore
      // fetches from the wrong offset with the wrong follow/community sets.
      setPosts(cached);
      offsetRef.current = cached.length;
      followingIdsRef.current = null;
      myCommunityIdsRef.current = null;
      setHasMore(true);
      setLoading(false);
      return;
    }
    if (!cached) setLoading(true);
    setPosts(cached || []);
    offsetRef.current = 0;
    followingIdsRef.current = null;
    myCommunityIdsRef.current = null;
    fetchPosts(true);
    // sdk in deps: this effect's first run fires while the session is still
    // restoring (sdk null), and fetchPosts no-ops by design (no shared-key
    // fallback anymore). Without re-firing when sdk lands, the feed (and the
    // trending/discover surfaces built on usePosts) stranded on empty/error.
  }, [cacheKey, sdk]);

  // Silent re-fetch — used by tab focus, polling, and any background
  // freshness check. Just re-queries the post list. Does NOT trigger
  // the curator (which is a 10-20s RSS + LLM round-trip and shouldn't
  // fire on every tab switch). Passes silent=true so the FlatList's
  // RefreshControl doesn't flash a stuck inset on focus.
  const refresh = React.useCallback(() => fetchPosts(true, true), [fetchPosts]);

  // User-initiated pull-to-refresh on the personal feed actually asks
  // the agent for fresh content: ensures the personal agent exists,
  // builds the Minds-flavoured curator request locally, calls the
  // generic Recursiv curator primitive, then re-fetches. Only triggered
  // on explicit user gestures — focus refreshes stay silent. When the
  // user has disabled AI in Settings we never call the curator and just
  // re-fetch chronologically.
  // Fire-and-forget curator refresh. Returns fast (status: fresh /
  // already-running / started) instead of awaiting the 5-15s pipeline.
  // Background work updates curation_run when it completes; the user
  // sees fresher content on the NEXT view, not after a long spinner.
  // Falls back to the legacy awaited path only if refreshIfStale isn't
  // available on the SDK (older client / staging).
  // Pull-to-refresh on the For You feed. The feed is now ranked server-side by
  // the recommender (sdk.curator.forYou), so "recurate" is just a re-fetch —
  // which re-ranks against the latest posts + signals. No per-user LLM
  // round-trip. Kept under the same name so call sites are unchanged.
  const recurate = React.useCallback(async () => {
    return fetchPosts(true);
  }, [fetchPosts]);

  const loadMore = React.useCallback(() => {
    if (Date.now() < cooldownUntilRef.current) return;
    if (hasMore && !loading && !refreshing) fetchPosts(false);
  }, [fetchPosts, hasMore, loading, refreshing]);

  return { posts, setPosts, loading, error, refreshing, refresh, recurate, loadMore, hasMore };
}

/**
 * Discover Posts feed — the master search console's Posts tab.
 *
 * Unlike usePosts (which the main Feed uses and bakes in follow/community
 * personalization), this is a THIN paginator over the raw /posts list with the
 * server params the console exposes as filters:
 *   - order: 'new'  → recency (no sort param, server default)
 *            'top'  → sort=score (all-time top, server ORDER BY score)
 *            'hot'  → sort=hot (Reddit-style engagement/age decay computed in
 *                     SQL across the WHOLE corpus — not a client window)
 *   - since:  ISO string → ?since= (server filters created_at >= since; honored)
 *   - until:  ISO string → ?until= (server filters created_at <= until; honored)
 *   - tagId:  string → ?tag_ids= (topic filter via post_tag join; honored)
 *
 * Every filter here maps to a server param the /posts route honors (verified in
 * packages/server/.../rest/routes/posts.ts), so the returned pages are ALREADY
 * the right sort + window — the caller only needs dedup. A light client re-sort
 * stays in the caller as defense (stable ordering across merged pages), but the
 * server is the source of truth. Infinite scroll via loadMore.
 */
export function useDiscoverPosts(opts: { order: 'new' | 'top' | 'hot'; since?: string; until?: string; tagId?: string; limit?: number }) {
  const { order, since, until, tagId, limit = 30 } = opts;
  const { sdk } = useAuth();
  // Server sort: 'top' → score (all-time), 'hot' → SQL hot decay over the whole
  // corpus, 'new' → server default (recency). All three are real server orders.
  const serverSort = order === 'top' ? 'score' : order === 'hot' ? 'hot' : undefined;
  const cacheKey = `discover-posts:${serverSort || 'recent'}:${since || ''}:${until || ''}:${tagId || ''}:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const offsetRef = React.useRef(0);
  const reqIdRef = React.useRef(0);
  const inFlightRef = React.useRef(false);

  const buildParams = React.useCallback((offset: number) => {
    const p: Record<string, any> = { limit, offset };
    // Network scope (org_id NULL legacy posts included) — same reasoning as
    // usePosts('score'): org-scoping the discovery fetch hides imported content.
    if (serverSort) p.sort = serverSort;
    else if (ORG_ID) p.organization_id = ORG_ID;
    // Date window — server filters created_at by these (honored). The caller
    // keeps a withinRange() client filter as cheap defense, but the server has
    // already windowed the rows so the feed is accurate over the FULL corpus
    // (not just whatever the first page happened to contain).
    if (since) p.since = since;
    if (until) p.until = until;
    if (tagId) p.tag_ids = tagId;
    return p;
  }, [serverSort, since, until, tagId, limit]);

  const fetchPage = React.useCallback(async (refresh: boolean) => {
    if (!sdk) return; // identity-scoped; never fall back to the shared app key
    if (inFlightRef.current && !refresh) return;
    const myReq = ++reqIdRef.current;
    inFlightRef.current = true;
    const stale = () => reqIdRef.current !== myReq;
    try {
      if (refresh) { setRefreshing(true); offsetRef.current = 0; }
      const offset = refresh ? 0 : offsetRef.current;
      const res: any = await fetchDeduped(`req:${cacheKey}:${offset}`, () =>
        sdk.posts.list(buildParams(offset) as any));
      if (stale()) return;
      const raw = res.data || [];
      const more = res.meta?.has_more ?? raw.length >= limit;
      const visible = filterMuted(raw);
      visible.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });
      setPosts((prev) => {
        const base = refresh ? [] : prev;
        const seen = new Set(base.map((p: any) => p.id));
        const merged = [...base, ...visible.filter((p: any) => !seen.has(p.id))];
        setCache(cacheKey, merged);
        return merged;
      });
      setHasMore(more);
      offsetRef.current = offset + raw.length;
    } catch (err: any) {
      captureException(err, { hook: 'useDiscoverPosts', order });
    } finally {
      if (!stale()) { inFlightRef.current = false; setLoading(false); setRefreshing(false); }
    }
  }, [sdk, cacheKey, buildParams, limit, order]);

  // Refetch from scratch whenever the server query (sort/since/tag) changes.
  React.useEffect(() => {
    const fresh = getCached(cacheKey);
    setPosts(fresh || []);
    setLoading(!fresh);
    offsetRef.current = 0;
    setHasMore(true);
    fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, sdk]);

  const loadMore = React.useCallback(() => {
    if (hasMore && !loading && !refreshing && !inFlightRef.current) fetchPage(false);
  }, [fetchPage, hasMore, loading, refreshing]);

  return { posts, loading, refreshing, hasMore, loadMore, refresh: () => fetchPage(true) };
}

/**
 * Trending posts for the right-rail sidebar widget — a SELF-CONTAINED,
 * never-silently-empty source for "what's hot right now".
 *
 * Why this exists (root cause of the empty Trending Posts widget):
 * The sidebar previously used useDiscoverPosts({ order: 'hot' }) as its ONLY
 * source. `sort=hot` is the right ranking (Reddit-style engagement decayed by
 * age — recency-aware, not all-time bangers), but it is a SINGLE point of
 * failure: if that one request returns 0 rows (a transient server error, an
 * empty hot window, or a deploy where the hot path misbehaves) the widget has
 * NOTHING to fall back to and renders the empty state — exactly the reported
 * bug, which a pure client-side rank/dedup tweak could never fix because the
 * fetched pool itself was empty.
 *
 * The fix is a two-tier fetch with a guaranteed fallback:
 *   1. PRIMARY  → /posts?sort=hot  (engagement-weighted + age-decayed: a fresh,
 *                 modestly-engaged post out-ranks a years-old all-time banger,
 *                 so the rail feels current over a mostly-historical corpus).
 *   2. FALLBACK → /posts?sort=score (all-time top — the same discovery path the
 *                 For-You feed leans on, which is known to populate) — used ONLY
 *                 when hot returns nothing, then re-ranked client-side by the
 *                 same hotScore so the order still favors recency.
 * Either way the widget shows ~limit genuinely-good posts whenever ANY exist,
 * and only shows its empty state when the corpus is truly empty.
 *
 * Network-scoped (no organization_id, like usePosts('score')) so imported
 * legacy posts — project-scoped with org_id NULL — are included rather than
 * leaving only the handful of native org posts. The server's /posts route
 * already applies the Minds-tenant + discover quality filters (original posts
 * only, non-blank, viewer-accessible), so this never shows cross-tenant or
 * pollution rows.
 */
export function useTrendingPosts(limit = 5) {
  const { sdk } = useAuth();
  const cacheKey = `trending-posts:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);

  React.useEffect(() => {
    const fresh = getCached(cacheKey);
    if (fresh?.length) { setPosts(fresh); setLoading(false); }
    let cancelled = false;
    (async () => {
      if (!sdk) return; // identity-scoped; never fall back to the shared app key
      const s = sdk;
      // Over-fetch a real pool so the client ranker + dedup have something to
      // choose from, then the caller slices to `limit`.
      const pool = Math.max(limit * 6, 30);
      // "Top this month" — window to the last 30 days (the week window had ZERO engagement on the relaunch corpus; 30d is the smallest window with real score + media) so the rail shows what's
      // trending NOW (score-ranked within the window), not the all-time greatest
      // hits. Coarse day-bucketed `since` so the fetch cache key stays stable
      // through the day.
      const since = new Date(Date.now() - 30 * 86_400_000);
      const sinceIso = since.toISOString();
      const dayBucket = sinceIso.slice(0, 10);
      const fetchSort = (sort: 'hot' | 'score') =>
        fetchDeduped(`req:trending-posts:${sort}:${pool}:${dayBucket}`, () =>
          s.posts.list({ limit: pool, sort, since: sinceIso } as any) as Promise<any>);
      try {
        // PRIMARY: score (engagement-ranked). The hot/recency pool is polluted on
        // the relaunch corpus — a simulator floods the newest posts with
        // 0-engagement emoji/gif spam, so recency-first surfaced junk with "0 pts"
        // and no media. Engagement-ranked shows posts that actually earned reach
        // (real score + media previews).
        let res: any = await fetchSort('score');
        let data: any[] = filterMuted(res?.data || []);
        // FALLBACK: hot, if score yields nothing at all.
        if (data.length === 0) {
          res = await fetchSort('hot');
          data = filterMuted(res?.data || []);
        }
        if (cancelled) return;
        data.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });
        setPosts(data);
        setCache(cacheKey, data);
      } catch (err: any) {
        // Non-fatal — keep whatever cache we have; the widget renders its empty
        // state only if there was never any data.
        captureException(err, { hook: 'useTrendingPosts' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, cacheKey]);

  return { posts, loading };
}

/**
 * Paginated feed of a single author's posts (or replies).
 *
 * The profile screen used to one-shot `posts.list({ author_id, limit: 50 })`
 * with no offset/has_more tracking and render the result in a ScrollView —
 * so a profile capped at one page (~the first 10-50 rows) and never loaded
 * more on scroll, even for users with thousands of posts (e.g. John, 10,405).
 *
 * This mirrors useDiscoverPosts: a thin cursor paginator over the raw /posts
 * list, scoped by `author_id` server-side, with offset + has_more + loadMore
 * for infinite scroll. Set `replies: true` for the Replies tab (server
 * returns the author's replies with the parent post hydrated).
 */
export function useProfilePosts(authorId: string | undefined, opts?: { replies?: boolean; limit?: number }) {
  const { sdk } = useAuth();
  const replies = !!opts?.replies;
  const limit = opts?.limit ?? 30;
  const cacheKey = `profile-posts:${authorId || 'none'}:${replies ? 'replies' : 'posts'}:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && !!authorId);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const offsetRef = React.useRef(0);
  const reqIdRef = React.useRef(0);
  const inFlightRef = React.useRef(false);

  const fetchPage = React.useCallback(async (refresh: boolean) => {
    if (!sdk || !authorId) return; // identity-scoped; never fall back to the shared app key
    if (inFlightRef.current && !refresh) return;
    const myReq = ++reqIdRef.current;
    inFlightRef.current = true;
    const stale = () => reqIdRef.current !== myReq;
    try {
      if (refresh) { setRefreshing(true); offsetRef.current = 0; }
      const offset = refresh ? 0 : offsetRef.current;
      // NOTE: REST param is snake_case `author_id`; `replies=true` asks the
      // server for the author's replies with the parent hydrated. Both passed
      // via `as any` because `replies` isn't on the typed ListPostsParams.
      const res: any = await fetchDeduped(`req:${cacheKey}:${offset}`, () =>
        sdk.posts.list({ author_id: authorId, limit, offset, ...(replies ? { replies: true } : {}) } as any));
      if (stale()) return;
      const raw = res.data || [];
      const more = res.meta?.has_more ?? raw.length >= limit;
      const visible = filterMuted(raw);
      visible.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });
      setPosts((prev) => {
        const base = refresh ? [] : prev;
        const seen = new Set(base.map((p: any) => p.id));
        const merged = [...base, ...visible.filter((p: any) => !seen.has(p.id))];
        setCache(cacheKey, merged);
        return merged;
      });
      setHasMore(more);
      offsetRef.current = offset + raw.length;
    } catch (err: any) {
      captureException(err, { hook: 'useProfilePosts', replies });
    } finally {
      if (!stale()) { inFlightRef.current = false; setLoading(false); setRefreshing(false); }
    }
  }, [sdk, authorId, cacheKey, limit, replies]);

  // Refetch from scratch whenever the author (or sdk) changes.
  React.useEffect(() => {
    const fresh = getCached(cacheKey);
    setPosts(fresh || []);
    setLoading(!fresh && !!authorId);
    offsetRef.current = 0;
    setHasMore(true);
    if (authorId) fetchPage(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, sdk, authorId]);

  const loadMore = React.useCallback(() => {
    if (hasMore && !loading && !refreshing && !inFlightRef.current) fetchPage(false);
  }, [fetchPage, hasMore, loading, refreshing]);

  return { posts, loading, refreshing, hasMore, loadMore, refresh: () => fetchPage(true) };
}

/**
 * Fetch a single post by ID.
 */
export function usePost(postId: string) {
  const { sdk } = useAuth();
  const cacheKey = `post:${postId}`;
  const cached = getCached(cacheKey);
  const [post, setPost] = React.useState<any>(cached || null);
  const [loading, setLoading] = React.useState(!cached);
  const [error, setError] = React.useState<string | null>(null);

  // Reset when postId changes — never flash wrong post
  React.useEffect(() => {
    const freshCached = getCached(`post:${postId}`);
    setPost(freshCached || null);
    setLoading(!freshCached);
    setError(null);
  }, [postId]);

  // Always revalidate on mount (stale-while-revalidate). Replies change far
  // more often than the 30s cache window, so a fresh cache used to be served
  // WITHOUT a refetch — meaning a new reply (yours or someone else's) wouldn't
  // show until the cache expired. We still render the cached copy instantly
  // (no flash), but we always fetch the canonical post + replies in the
  // background and reconcile.
  React.useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        const res = await fetchDeduped(`req:post:${postId}`, () => s.posts.get(postId));
        if (!cancelled) {
          setPost(res.data);
          setCache(cacheKey, res.data);
        }
      } catch (err: any) {
        if (!cancelled) { captureException(err, { hook: 'usePost', postId }); if (!cached) setError(err.message || 'Failed to load post'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId, sdk]);

  return { post, setPost, loading, error };
}

/**
 * "More like this" — semantically related posts for the post-detail page so it
 * never dead-ends.
 *
 * Uses the existing server endpoint `GET /posts/:id/similar` (kNN over post
 * embeddings). The typed SDK has no `posts.similar()` method yet, so we reach
 * the resource's underlying HttpClient directly (same `(s as any)` escape hatch
 * the rest of this file uses for endpoints ahead of the SDK types). Returns []
 * gracefully when the seed has no embedding or the endpoint is unavailable.
 */
export function useSimilarPosts(postId: string | undefined, limit = 10) {
  const { sdk } = useAuth();
  const cacheKey = `similar-posts:${postId || 'none'}:${limit}`;
  const cached = getCached(cacheKey);
  const [posts, setPosts] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && !!postId);

  React.useEffect(() => {
    if (!postId) { setPosts([]); setLoading(false); return; }
    const fresh = getCached(cacheKey);
    setPosts(fresh || []);
    setLoading(!fresh);
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped; never fall back to the shared app key
        // The HttpClient lives on every resource as `client`; use the posts
        // resource's to hit the un-typed similar endpoint.
        const http = (sdk.posts as any)?.client;
        if (!http?.get) { if (!cancelled) setLoading(false); return; }
        const res: any = await fetchDeduped(`req:similar:${postId}:${limit}`, () =>
          http.get(`/posts/${postId}/similar`, { limit, organization_id: ORG_ID || undefined }));
        if (!cancelled) {
          const data = filterMuted(res?.data || []);
          data.forEach((p: any) => { if (p.id) setCache(`post:${p.id}`, p); });
          setPosts(data);
          setCache(cacheKey, data);
        }
      } catch (err: any) {
        // Non-fatal — the section just renders its empty state.
        captureException(err, { hook: 'useSimilarPosts', postId });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [postId, sdk, limit, cacheKey]);

  return { posts, loading };
}

/**
 * Fetch communities scoped to Minds org.
 */
export function useCommunities(limit = 20, opts?: { memberOnly?: boolean }) {
  const { sdk } = useAuth();
  // memberOnly → server-side `member=true`: the caller's own (accepted)
  // communities. Required at 96K communities — "mine" can no longer be derived
  // from is_member flags on page one of the public directory.
  const memberOnly = !!opts?.memberOnly;
  const cacheKey = `communities:${limit}:${memberOnly ? 'mine' : 'all'}`;
  const cached = getCached(cacheKey);
  const [communities, setCommunities] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && limit > 0);
  const [error, setError] = React.useState<string | null>(null);
  // True only after the first network fetch resolves this session. The sidebar
  // gates its is_member-filtered list on this so a STALE cached membership can
  // never flash before fresh server data confirms it — the intermittent phantom
  // QA/Support communities bug (the cache says joined, the server says no).
  const [fetchedOnce, setFetchedOnce] = React.useState(false);

  const fetch = React.useCallback(async () => {
    if (limit === 0) return;
    try {
      if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
      const s = sdk;
      const res = await fetchDeduped(`req:communities:${limit}:${memberOnly ? 'mine' : 'all'}`, () =>
        s.communities.list({ limit, organization_id: ORG_ID || undefined, ...(memberOnly ? { member: 'true' } : {}) } as any));
      const data = res.data || [];
      setCommunities(data);
      setCache(cacheKey, data);
    } catch (err: any) {
      setError(err.message || 'Failed to load communities');
    } finally {
      setLoading(false);
      setFetchedOnce(true);
    }
  }, [sdk, limit, cacheKey]);

  React.useEffect(() => {
    // Always revalidate on mount (stale-while-revalidate). We still render the
    // cached list instantly, but we MUST refetch so a stale `is_member` flag
    // can't persist — otherwise communities a user left (or that a server bug
    // once mislabeled as joined, e.g. the phantom QA/Support communities) linger
    // in the sidebar forever because the cache looked "fresh".
    if (cached) setLoading(false);
    fetch();
  }, [fetch]);

  // Refetch when any `communities:*` cache entry is invalidated (e.g. the
  // user joined or left a community on another screen) so the sidebar
  // Recents list reflects the new membership without a logout/login cycle.
  React.useEffect(() => {
    const unsub = subscribeToInvalidations((key) => {
      if (key.startsWith('communities:')) {
        fetch();
      }
    });
    return unsub;
  }, [fetch]);

  return { communities, loading, error, fetchedOnce, refresh: fetch };
}

/**
 * Fetch discoverable agents scoped to Minds org.
 */
export function useAgents(limit = 20) {
  const { sdk } = useAuth();
  const cacheKey = `agents:${limit}`;
  const cached = getCached(cacheKey);
  const [agents, setAgents] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && limit > 0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (limit === 0) { setLoading(false); return; }
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        // Discover Agents = agents BOUND to this app (agent_project_access), not
        // every agent of the owning org. The session key is project-bound
        // (projectId=Minds), so the server's /agents/discoverable scopes to the
        // project's granted agents automatically WHEN organization_id is absent.
        // Passing organization_id forces the org-scoped path instead, which
        // surfaces operator/personal agents (aiOrganizationId === ORG) that
        // aren't part of the curated discover set — the cross-tenant-looking
        // bug. Omit it so an app with zero project agents returns [] and the
        // widget hides cleanly (no global/cross-tenant fallback).
        const res = await fetchDeduped(`req:agents:${limit}`, () => s.agents.listDiscoverable({ limit }));
        if (!cancelled) {
          const data = res.data || [];
          setAgents(data);
          setCache(cacheKey, data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load agents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, cacheKey]);

  return { agents, loading, error };
}

/**
 * Fetch a user profile by username.
 */
export function useProfile(username: string) {
  const { sdk } = useAuth();
  const cacheKey = `profile:${username}`;
  const cached = getCached(cacheKey);
  const [profile, setProfile] = React.useState<any>(cached || null);
  const [loading, setLoading] = React.useState(!cached);
  const [error, setError] = React.useState<string | null>(null);
  const [isFollowing, setIsFollowing] = React.useState(false);

  // Reset when username changes — never show stale profile for different user
  React.useEffect(() => {
    const freshCached = getCached(`profile:${username}`);
    setProfile(freshCached || null);
    setLoading(!freshCached);
    setError(null);
    setIsFollowing(false);
  }, [username]);

  React.useEffect(() => {
    if (!username) return;
    // Always revalidate on mount (stale-while-revalidate). The cached profile
    // renders instantly, but we MUST re-fetch — a fresh cache used to early-
    // return here, which skipped the isFollowing fetch below, so after a page
    // refresh the follow button wrongly showed "Follow" for someone you already
    // follow (then "already following" if you clicked it).
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        let res;
        try {
          res = await s.profiles.getByUsername(username);
        } catch {
          try {
            res = await s.profiles.get(username);
          } catch {
            try {
              const agentRes = await (s as any).agents.listDiscoverable({ limit: 200, organization_id: ORG_ID || undefined });
              const agents = agentRes.data || [];
              const match = agents.find((a: any) => a.username === username || a.id === username);
              if (match) {
                res = { data: { id: match.id, name: match.name, username: match.username, bio: match.bio || match.description, image: match.image || match.avatar, isAgent: true } };
              }
            } catch {}
            if (!res) throw new Error('User not found');
          }
        }
        if (!cancelled && res?.data) {
          setProfile(res.data);
          setCache(cacheKey, res.data);
          if (!(res.data as any).isAgent) {
            try {
              const followRes = await s.profiles.isFollowing(res.data.id);
              setIsFollowing(followRes.data?.is_following ?? false);
            } catch {}
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'User not found');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [username, sdk]);

  const refresh = React.useCallback(async () => {
    if (!username) return;
    invalidatePrefix(cacheKey);
    try {
      if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
      const s = sdk;
      let res;
      try { res = await s.profiles.getByUsername(username); }
      catch { res = await s.profiles.get(username); }
      if (res?.data) {
        setProfile(res.data);
        setCache(cacheKey, res.data);
        // Re-sync follow state too, so it survives a refresh and reflects the
        // server after a follow/unfollow.
        if (!(res.data as any).isAgent) {
          try {
            const followRes = await s.profiles.isFollowing(res.data.id);
            setIsFollowing(followRes.data?.is_following ?? false);
          } catch {}
        }
      }
    } catch {}
  }, [username, sdk, cacheKey]);

  return { profile, setProfile, loading, error, isFollowing, setIsFollowing, refresh };
}

/**
 * Fetch the current user's profile.
 */
export function useMyProfile() {
  const { sdk, user } = useAuth();
  const cacheKey = 'myprofile';
  const cached = getCached(cacheKey);
  // Never start as null — use cached or auth user as initial value
  const [profile, setProfile] = React.useState<any>(cached || user || null);
  const [loading, setLoading] = React.useState(!cached && !user);

  const fetch = React.useCallback(async () => {
    if (!sdk) return;
    try {
      const res = await sdk.profiles.me();
      setProfile(res.data);
      setCache(cacheKey, res.data);
    } catch {}
    finally { setLoading(false); }
  }, [sdk]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    fetch();
  }, [fetch]);

  return { profile, loading, refresh: fetch };
}

/**
 * Fetch chat conversations.
 */
export function useConversations() {
  const { sdk } = useAuth();
  const cacheKey = 'conversations';
  const cached = getCached(cacheKey);
  const [conversations, setConversations] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);
  const [error, setError] = React.useState<string | null>(null);

  const fetch = React.useCallback(async () => {
    if (!sdk) return;
    try {
      const res = await sdk.chat.conversations({ limit: 50, organization_id: ORG_ID || undefined });
      const data = res.data || [];
      setConversations(data);
      setCache(cacheKey, data);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    fetch();
  }, [fetch]);

  // Match the invalidation contract used by useCommunities/usePosts so
  // any code path that calls `invalidate('conversations')` (e.g. agent
  // setup right after creating the personal-agent DM) forces this
  // sidebar to re-fetch without waiting 30s for the FRESH_MS window.
  React.useEffect(() => {
    const unsub = subscribeToInvalidations((key) => {
      if (key === cacheKey) fetch();
    });
    return unsub;
  }, [fetch]);

  return { conversations, loading, error, refresh: fetch };
}

/**
 * Fetch messages for a conversation.
 */
export function useMessages(conversationId: string) {
  const { sdk } = useAuth();
  const cacheKey = `messages:${conversationId}`;
  const cached = getCached(cacheKey);
  const [messages, setMessages] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);

  const fetch = React.useCallback(async () => {
    if (!sdk || !conversationId) return;
    try {
      const res = await sdk.chat.messages(conversationId, { limit: 50 });
      const data = res.data || [];
      setMessages(data);
      setCache(cacheKey, data);
    } catch {}
    finally { setLoading(false); }
  }, [sdk, conversationId, cacheKey]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    fetch();
  }, [fetch]);

  return { messages, setMessages, loading, refresh: fetch };
}

/**
 * Fetch tags.
 */
export function useTags(limit = 50) {
  const { sdk } = useAuth();
  const cacheKey = `tags:${limit}`;
  const cached = getCached(cacheKey);
  const [tags, setTags] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        const res = await s.tags.list({ limit });
        if (!cancelled) {
          const data = res.data || [];
          setTags(data);
          setCache(cacheKey, data);
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, cacheKey]);

  return { tags, loading };
}

/**
 * Fetch org members as profiles (scoped to Minds org).
 */
export function useProfiles(limit = 20) {
  const { sdk } = useAuth();
  const cacheKey = `profiles:${limit}`;
  const cached = getCached(cacheKey);
  const [profiles, setProfiles] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && limit > 0);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (limit === 0) { setLoading(false); return; }
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        // The people directory is the app's real user base = project_members.
        // The session key is project-bound (projectId=Minds), so the server
        // scopes /profiles to project_members automatically; we pass org_id
        // only as a fallback for non-project-bound keys. (Previously this
        // used organizations.members(ORG), which returned org_members — the
        // operator team — and hid real users like project-member agents.)
        const res = await fetchDeduped(`req:profiles:${limit}`, () =>
          s.profiles.list({ limit, organization_id: ORG_ID || undefined } as any)
        );
        let data: any[] = res.data || [];
        // Filter out AI agents — they show in the Agents section
        data = data.filter((p: any) => !p.isAi && !p.is_ai && p.type !== 'agent');
        if (!cancelled) {
          setProfiles(data);
          setCache(cacheKey, data);
          // Pre-cache individual profiles so clicking is instant
          data.forEach((p: any) => {
            if (p.username) setCache(`profile:${p.username}`, p);
            if (p.id) setCache(`profile:${p.id}`, p);
          });
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load profiles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, cacheKey]);

  return { profiles, loading, error };
}

/**
 * The signed-in viewer's set of followed user ids — the real source of truth for
 * "am I following this person".
 *
 * The /profiles directory + /profiles/leaderboard payloads carry NO per-row
 * follow flag, so seeding a "Following" pill from `is_following` on those rows is
 * always false. Instead we fetch the viewer's OWN following list once
 * (sdk.profiles.following — the same call the Following feed uses) and expose it
 * as a Set, so any directory/leaderboard row can be checked for membership.
 */
export function useFollowingIds() {
  const { sdk, user } = useAuth();
  const cacheKey = user?.id ? `following-ids:${user.id}` : null;
  const cached = cacheKey ? getCached(cacheKey) : null;
  const [ids, setIds] = React.useState<Set<string>>(() => new Set<string>(cached || []));
  const [loading, setLoading] = React.useState(!cached);

  React.useEffect(() => {
    if (!sdk || !user?.id || !cacheKey) { setLoading(false); return; }
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchDeduped(`req:following:${user.id}`, () => sdk.profiles.following(user.id, { limit: 500 }));
        const list: string[] = (res.data || []).map((p: any) => p.id).filter(Boolean);
        if (!cancelled) {
          setIds(new Set(list));
          setCache(cacheKey, list);
        }
      } catch {
        // Leave whatever we have (empty or cached) — a failed fetch must not
        // wipe a working set.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, user?.id, cacheKey]);

  return { followingIds: ids, loading };
}

/**
 * Engagement leaderboard for people (server-ranked by post_count + reactions).
 *
 * The plain /profiles list returns NO follower/post counts — just identity
 * columns ordered by signup date — so a client-side "Most active" sort over it
 * has nothing to rank on. This endpoint (/profiles/leaderboard, server max 100)
 * returns post_count + engagement per user, network-ranked. The People tab joins
 * it onto the project-scoped directory by user id to give the "Most active" chip
 * a real signal without a server change. Returns a Map id -> {post_count,
 * engagement} so callers can enrich their own list.
 */
export function useProfileLeaderboard(limit = 100, sort: 'engagement' | 'followers' = 'engagement') {
  const { sdk } = useAuth();
  const cacheKey = `profile-leaderboard:${sort}:${limit}`;
  const cached = getCached(cacheKey);
  const [entries, setEntries] = React.useState<any[]>(cached || []);
  const [loading, setLoading] = React.useState(!cached && limit > 0);

  React.useEffect(() => {
    if (limit === 0) { setLoading(false); return; }
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key
        const s = sdk;
        const res: any = await fetchDeduped(`req:profile-leaderboard:${sort}:${limit}`, () =>
          (s as any).profiles.leaderboard({ limit, sort, organization_id: ORG_ID || undefined }));
        if (!cancelled) {
          const data = res.data || [];
          setEntries(data);
          setCache(cacheKey, data);
        }
      } catch {
        // Non-fatal: the People tab falls back to follower-only ranking.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit, sort, cacheKey]);

  const byId = React.useMemo(() => {
    const m = new Map<string, { postCount: number; engagement: number; followerCount: number }>();
    for (const e of entries) {
      if (e?.id) m.set(e.id, {
        postCount: Number(e.post_count ?? e.postCount ?? 0) || 0,
        engagement: Number(e.engagement ?? 0) || 0,
        followerCount: Number(e.follower_count ?? e.followerCount ?? 0) || 0,
      });
    }
    return m;
  }, [entries]);

  // The server-ranked order of ids (top-N for this sort), so a caller can present
  // the leaderboard's exact ordering even when joining onto another list.
  const orderedIds = React.useMemo(() => entries.map((e: any) => e?.id).filter(Boolean) as string[], [entries]);

  return { entries, byId, orderedIds, loading };
}

/**
 * Search posts scoped to Minds org. Optionally composes the same time-window
 * (since/until) + topic (tag_ids) filters the Discover Posts tab exposes, so a
 * search honors the active Time + Topic pills server-side (the FTS route honors
 * since/until/tag_ids) instead of the caller client-filtering the top-N.
 */
export function useSearchPosts(query: string, opts?: { since?: string; until?: string; tagId?: string }) {
  const { sdk } = useAuth();
  const { since, until, tagId } = opts || {};
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) {
      // Clearing the query mid-search left loading=true, so the search
      // results UI kept a spinner over an empty list. Reset both.
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        // Search posts — compose the active time/topic filters into the FTS query.
        const res = await s.posts.search({
          q: query,
          limit: 20,
          organization_id: ORG_ID || undefined,
          ...(since ? { since } : {}),
          ...(until ? { until } : {}),
          ...(tagId ? { tag_ids: tagId } : {}),
        } as any);
        if (!cancelled) setResults(res.data || []);
      } catch {
        // If posts.search fails, fall back to listing and client-side filtering
        if (!cancelled) {
          try {
            if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
            const s = sdk;
            const res = await s.posts.list({ limit: 50, organization_id: ORG_ID || undefined });
            const q = query.toLowerCase();
            const filtered = (res.data || []).filter((p: any) =>
              (p.content || '').toLowerCase().includes(q) ||
              (p.title || '').toLowerCase().includes(q) ||
              (p.author?.name || '').toLowerCase().includes(q)
            );
            if (!cancelled) setResults(filtered);
          } catch {}
        }
      }
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, sdk, since, until, tagId]);

  return { results, loading };
}

/**
 * Unified search across posts, profiles, and communities.
 */
export function useSearch(query: string) {
  const { sdk } = useAuth();
  const [posts, setPosts] = React.useState<any[]>([]);
  const [people, setPeople] = React.useState<any[]>([]);
  const [communities, setCommunities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!query.trim()) {
      setPosts([]);
      setPeople([]);
      setCommunities([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        if (!sdk) return; // identity-scoped fetch: NEVER fall back to the shared app key (it resolves to the key owner, not the signed-in user)
        const s = sdk;
        const q = query.toLowerCase();

        // Search in parallel
        const [postRes, profileRes, commRes] = await Promise.allSettled([
          s.posts.search({ q: query, limit: 10, organization_id: ORG_ID || undefined }),
          s.profiles.search ? s.profiles.search({ q: query, limit: 10, organization_id: ORG_ID || undefined }) : Promise.reject('no search'),
          s.communities.list({ limit: 50, organization_id: ORG_ID || undefined }),
        ]);

        if (!cancelled) {
          setPosts(postRes.status === 'fulfilled' ? postRes.value.data || [] : []);
          setPeople(profileRes.status === 'fulfilled' ? profileRes.value.data || [] : []);
          // Client-side filter communities since there's no search endpoint
          const allComm = commRes.status === 'fulfilled' ? commRes.value.data || [] : [];
          setCommunities(allComm.filter((c: any) =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.description || '').toLowerCase().includes(q)
          ));
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, sdk]);

  return { posts, people, communities, loading };
}
