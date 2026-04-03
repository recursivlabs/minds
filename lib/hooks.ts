import * as React from 'react';
import { useAuth } from './auth';
import { getSdk, ORG_ID } from './recursiv';

/**
 * Fetch posts from the feed.
 * All calls scoped to the Minds org.
 */
export function usePosts(sort: 'score' | 'latest' | 'following' = 'latest', limit = 20) {
  const { sdk } = useAuth();
  const [posts, setPosts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const offsetRef = React.useRef(0);

  const fetchPosts = React.useCallback(async (refresh = false) => {
    const s = sdk || getSdk();
    if (!s) return;
    try {
      if (refresh) {
        setRefreshing(true);
        offsetRef.current = 0;
      }
      const res = await s.posts.list({ limit, offset: refresh ? 0 : offsetRef.current, organization_id: ORG_ID || undefined });
      let data = res.data || [];

      if (sort === 'score') {
        data = [...data].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      } else if (sort === 'latest') {
        data = [...data].sort((a: any, b: any) =>
          new Date(b.createdAt || b.created_at || 0).getTime() -
          new Date(a.createdAt || a.created_at || 0).getTime()
        );
      }

      if (refresh) {
        setPosts(data);
      } else {
        setPosts(prev => [...prev, ...data]);
      }
      setHasMore(res.meta?.has_more ?? data.length >= limit);
      offsetRef.current = (refresh ? 0 : offsetRef.current) + data.length;
    } catch (err: any) {
      setError(err.message || 'Failed to load posts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [sdk, sort, limit]);

  React.useEffect(() => {
    setLoading(true);
    setPosts([]);
    offsetRef.current = 0;
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
  const [post, setPost] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!postId) return;
    let cancelled = false;
    (async () => {
      try {
        const s = sdk || getSdk();
        const res = await s.posts.get(postId);
        if (!cancelled) setPost(res.data);
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
  const [communities, setCommunities] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetch = React.useCallback(async () => {
    try {
      const s = sdk || getSdk();
      const res = await s.communities.list({ limit, organization_id: ORG_ID || undefined });
      setCommunities(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load communities');
    } finally {
      setLoading(false);
    }
  }, [sdk, limit]);

  React.useEffect(() => { fetch(); }, [fetch]);

  return { communities, loading, error, refresh: fetch };
}

/**
 * Fetch discoverable agents scoped to Minds org.
 */
export function useAgents(limit = 20) {
  const { sdk } = useAuth();
  const [agents, setAgents] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = sdk || getSdk();
        const res = await s.agents.listDiscoverable({ limit, organization_id: ORG_ID || undefined });
        if (!cancelled) setAgents(res.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load agents');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit]);

  return { agents, loading, error };
}

/**
 * Fetch a user profile by username.
 */
export function useProfile(username: string) {
  const { sdk } = useAuth();
  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isFollowing, setIsFollowing] = React.useState(false);

  React.useEffect(() => {
    if (!username) return;
    let cancelled = false;
    (async () => {
      try {
        const s = sdk || getSdk();
        const res = await s.profiles.getByUsername(username);
        if (!cancelled) {
          setProfile(res.data);
          try {
            const followRes = await s.profiles.isFollowing(res.data.id);
            setIsFollowing(followRes.data?.following ?? false);
          } catch {}
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load profile');
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
  const { sdk } = useAuth();
  const [profile, setProfile] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);

  const fetch = React.useCallback(async () => {
    if (!sdk) return;
    try {
      const res = await sdk.profiles.me();
      setProfile(res.data);
    } catch {}
    finally { setLoading(false); }
  }, [sdk]);

  React.useEffect(() => { fetch(); }, [fetch]);

  return { profile, loading, refresh: fetch };
}

/**
 * Fetch chat conversations.
 */
export function useConversations() {
  const { sdk } = useAuth();
  const [conversations, setConversations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetch = React.useCallback(async () => {
    if (!sdk) return;
    try {
      const res = await sdk.chat.conversations({ limit: 50 });
      setConversations(res.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  React.useEffect(() => { fetch(); }, [fetch]);

  return { conversations, loading, error, refresh: fetch };
}

/**
 * Fetch messages for a conversation.
 */
export function useMessages(conversationId: string) {
  const { sdk } = useAuth();
  const [messages, setMessages] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetch = React.useCallback(async () => {
    if (!sdk || !conversationId) return;
    try {
      const res = await sdk.chat.messages(conversationId, { limit: 50 });
      setMessages(res.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [sdk, conversationId]);

  React.useEffect(() => { fetch(); }, [fetch]);

  return { messages, setMessages, loading, refresh: fetch };
}

/**
 * Fetch tags.
 */
export function useTags(limit = 50) {
  const { sdk } = useAuth();
  const [tags, setTags] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = sdk || getSdk();
        const res = await s.tags.list({ limit });
        if (!cancelled) setTags(res.data || []);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit]);

  return { tags, loading };
}

/**
 * Fetch a list of profiles/people.
 */
export function useProfiles(limit = 20) {
  const { sdk } = useAuth();
  const [profiles, setProfiles] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = sdk || getSdk();
        const res = await s.profiles.list({ limit } as any);
        if (!cancelled) setProfiles(res.data || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load profiles');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sdk, limit]);

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
        const res = await s.posts.search({ query, limit: 20, organization_id: ORG_ID || undefined });
        if (!cancelled) setResults(res.data || []);
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query, sdk]);

  return { results, loading };
}
