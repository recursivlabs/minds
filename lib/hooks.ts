import * as React from 'react';
import { useAuth } from './auth';
import { ORG_ID } from './recursiv';
import { getCached, setCache, isFresh, invalidatePrefix, subscribeToInvalidations, fetchDeduped } from './cache';
import { filterMuted } from './muted';
import { loadPreferences, markCuratedNow } from './onboarding';
import { buildCuratorRequest } from './curator';
import { getPreference } from './preferences';
import { captureException } from './monitoring';

// Once-per-session guard for the personal-agent config upsert (see recurate).
let ensuredPersonalThisSession = false;

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

      if (sort === 'following' && user?.id && !followingIdsRef.current) {
        try {
          const followingRes = await fetchDeduped(`req:following:${user.id}`, () => s.profiles.following(user.id, { limit: 500 }));
          const ids = new Set((followingRes.data || []).map((p: any) => p.id));
          ids.add(user.id); // your own posts belong in your Following feed
          followingIdsRef.current = ids;
        } catch {
          // Fall back to a set with just you, so at minimum your own posts show.
          followingIdsRef.current = new Set([user.id]);
        }
      }

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
      // the imported content. Other sorts keep org scope.
      if (ORG_ID && sort !== 'score') {
        baseParams.organization_id = ORG_ID;
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
        if (sort === 'following' && followingIdsRef.current) {
          visible = visible.filter((p: any) => {
            const authorId = p.author?.id || p.userId || p.user_id;
            return followingIdsRef.current?.has(authorId);
          });
        }
        visible = filterMuted(visible);
        data = data.concat(visible);
        if (data.length > 0 || raw.length === 0 || stale()) break;
      }
      if (stale()) return;

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
 * Fetch communities scoped to Minds org.
 */
export function useCommunities(limit = 20) {
  const { sdk } = useAuth();
  const cacheKey = `communities:${limit}`;
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
      const res = await fetchDeduped(`req:communities:${limit}`, () =>
        s.communities.list({ limit, organization_id: ORG_ID || undefined }));
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
        const res = await fetchDeduped(`req:agents:${limit}`, () => s.agents.listDiscoverable({ limit, organization_id: ORG_ID || undefined }));
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
 * Search posts scoped to Minds org.
 */
export function useSearchPosts(query: string) {
  const { sdk } = useAuth();
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
        // Search posts
        const res = await s.posts.search({ q: query, limit: 20, organization_id: ORG_ID || undefined });
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
  }, [query, sdk]);

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
