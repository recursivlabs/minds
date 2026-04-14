import * as React from 'react';
import { useAuth } from './auth';
import { getSdk, ORG_ID } from './recursiv';
import { getCached, setCache, isFresh, invalidatePrefix } from './cache';
import { filterMuted } from './muted';

/**
 * Fetch posts from the feed.
 * All calls scoped to the Minds org.
 */
export function usePosts(sort: 'score' | 'latest' | 'following' = 'latest', limit = 20) {
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

  const fetchPosts = React.useCallback(async (refresh = false) => {
    const s = sdk || getSdk();
    if (!s) return;
    try {
      if (refresh) {
        setRefreshing(true);
        offsetRef.current = 0;
      }

      if (sort === 'following' && user?.id && !followingIdsRef.current) {
        try {
          const followingRes = await s.profiles.following(user.id, { limit: 500 });
          const ids = new Set((followingRes.data || []).map((p: any) => p.id));
          followingIdsRef.current = ids;
        } catch {
          followingIdsRef.current = new Set();
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

      const res = await s.posts.list({ limit, offset: refresh ? 0 : offsetRef.current, organization_id: ORG_ID || undefined });
      let data = res.data || [];

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
      } else if (sort === 'following' && followingIdsRef.current) {
        data = data.filter((p: any) => {
          const authorId = p.author?.id || p.userId || p.user_id;
          return followingIdsRef.current!.has(authorId);
        });
      }

      // Filter muted users + pre-cache individual posts
      data = filterMuted(data);
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
      setHasMore(res.meta?.has_more ?? data.length >= limit);
      offsetRef.current = (refresh ? 0 : offsetRef.current) + data.length;
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sdk, sort, limit, user?.id, cacheKey]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) {
      setLoading(false);
      return;
    }
    if (!cached) setLoading(true);
    setPosts(cached || []);
    offsetRef.current = 0;
    followingIdsRef.current = null;
    myCommunityIdsRef.current = null;
    fetchPosts(true);
  }, [sort]);

  const refresh = React.useCallback(() => fetchPosts(true), [fetchPosts]);
  const loadMore = React.useCallback(() => {
    if (hasMore && !loading && !refreshing) fetchPosts(false);
  }, [fetchPosts, hasMore, loading, refreshing]);

  return { posts, setPosts, loading, error, refreshing, refresh, loadMore, hasMore };
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

  React.useEffect(() => {
    if (!postId) return;
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const s = sdk || getSdk();
        const res = await s.posts.get(postId);
        if (!cancelled) {
          setPost(res.data);
          setCache(cacheKey, res.data);
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load post');
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

  const fetch = React.useCallback(async () => {
    if (limit === 0) return;
    try {
      const s = sdk || getSdk();
      const res = await s.communities.list({ limit, organization_id: ORG_ID || undefined });
      const data = res.data || [];
      setCommunities(data);
      setCache(cacheKey, data);
    } catch (err: any) {
      setError(err.message || 'Failed to load communities');
    } finally {
      setLoading(false);
    }
  }, [sdk, limit, cacheKey]);

  React.useEffect(() => {
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    fetch();
  }, [fetch]);

  return { communities, loading, error, refresh: fetch };
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
        const s = sdk || getSdk();
        const res = await s.agents.listDiscoverable({ limit, organization_id: ORG_ID || undefined });
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
    if (isFresh(cacheKey) && cached) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const s = sdk || getSdk();
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
          if (!res.data.isAgent) {
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

  return { profile, setProfile, loading, error, isFollowing, setIsFollowing };
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
      const res = await sdk.chat.conversations({ limit: 50 });
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
        const s = sdk || getSdk();
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
        const s = sdk || getSdk();
        let data: any[];
        if (ORG_ID) {
          const res = await s.organizations.members(ORG_ID, { limit } as any);
          data = (res.data || []).map((m: any) => m.user || m);
        } else {
          const res = await s.profiles.list({ limit } as any);
          data = res.data || [];
        }
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
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const s = sdk || getSdk();
        // Search posts
        const res = await s.posts.search({ q: query, limit: 20, organization_id: ORG_ID || undefined });
        if (!cancelled) setResults(res.data || []);
      } catch {
        // If posts.search fails, fall back to listing and client-side filtering
        if (!cancelled) {
          try {
            const s = sdk || getSdk();
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
        const s = sdk || getSdk();
        const q = query.toLowerCase();

        // Search in parallel
        const [postRes, profileRes, commRes] = await Promise.allSettled([
          s.posts.search({ q: query, limit: 10, organization_id: ORG_ID || undefined }),
          s.profiles.search ? s.profiles.search({ query, limit: 10 }) : Promise.reject('no search'),
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
