/**
 * Global command palette — Cmd+K opens a modal overlay that doubles
 * as search-anywhere and a slash-command runner. Inspired by Linear /
 * Raycast / Slack / VSCode quick-open. Stays mounted at root so it's
 * available from any screen.
 *
 * What lives in it:
 *   - Plain text → unified search (posts + people + communities + agents)
 *   - @user      → user autocomplete
 *   - /find <q>  → jump to Discover filtered to that query
 *   - /post      → open compose
 *   - /dm <user> → open or create a DM with <user>
 *   - /ask <q>   → open personal-agent DM with prompt prefilled
 *   - /switch <community> → community jump
 *
 * Recent searches persist via lib/cache so the empty state shows
 * something useful on next open.
 */
import * as React from 'react';
import {
  View,
  TextInput,
  Pressable,
  Platform,
  Modal,
  FlatList,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { registerShortcut } from '../lib/keyboard';
import { getCached, setCache } from '../lib/cache';
import { ORG_ID } from '../lib/recursiv';
import { spacing, radius, typography } from '../constants/theme';
import { useColors } from '../lib/theme';

type ResultKind = 'post' | 'user' | 'community' | 'agent' | 'command' | 'recent';
interface Result {
  kind: ResultKind;
  id: string;
  title: string;
  subtitle?: string;
  avatar?: string;
  onPress: () => void;
}

const RECENT_KEY = 'minds:command-palette:recent';
const RECENT_LIMIT = 5;

function loadRecent(): string[] {
  try {
    const cached = getCached(RECENT_KEY);
    if (Array.isArray(cached)) return cached.slice(0, RECENT_LIMIT);
  } catch {}
  return [];
}

function pushRecent(query: string) {
  if (!query.trim()) return;
  const current = loadRecent();
  const deduped = [query, ...current.filter((q) => q !== query)].slice(0, RECENT_LIMIT);
  setCache(RECENT_KEY, deduped);
}

export function CommandPalette() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Result[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeIdx, setActiveIdx] = React.useState(0);
  const inputRef = React.useRef<TextInput>(null);

  // Bind Cmd+K / Ctrl+K globally.
  React.useEffect(() => {
    const unsub = registerShortcut('mod+k', () => {
      setOpen((o) => !o);
    });
    const unsubEsc = registerShortcut('escape', () => {
      setOpen(false);
    });
    return () => {
      unsub();
      unsubEsc();
    };
  }, []);

  // Reset state when opening; auto-focus the input on web.
  React.useEffect(() => {
    if (!open) return;
    setQuery('');
    setResults([]);
    setActiveIdx(0);
    // RN doesn't always autofocus in modals; force it.
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(t);
  }, [open]);

  const close = React.useCallback(() => {
    setOpen(false);
  }, []);

  const runFind = React.useCallback((q: string) => {
    pushRecent(q);
    close();
    router.push(`/(tabs)/discover/posts?q=${encodeURIComponent(q)}` as any);
  }, [router, close]);

  // Debounced unified search — auto-suggests creators, communities, and agents
  // (plus a few post hits), or Enter jumps to Discover. Runs when query changes.
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();

    if (!q) {
      // Empty state: surface recent searches + a few suggested commands
      // so the palette feels alive on open.
      const recents: Result[] = loadRecent().map((r) => ({
        kind: 'recent' as const,
        id: `recent:${r}`,
        title: r,
        subtitle: 'Recent search',
        onPress: () => runFind(r),
      }));
      setResults(recents);
      setActiveIdx(0);
      return;
    }

    // Slash commands fire on Enter (handled in onSubmitEditing).
    // Live result preview also honors @-handles and just-text search.
    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      if (!sdk) { setLoading(false); return; }
      try {
        // @ prefix = user search
        if (q.startsWith('@')) {
          const handle = q.slice(1);
          const res = await sdk.profiles.search({ q: handle || 'a', limit: 8 });
          if (cancelled) return;
          const mapped: Result[] = (res.data || []).map((p: any) => ({
            kind: 'user',
            id: p.id,
            title: p.name || p.username || 'Unknown',
            subtitle: p.username ? `@${p.username}` : undefined,
            avatar: p.image || p.avatar,
            onPress: () => {
              close();
              router.push(`/(tabs)/user/${p.username || p.id}` as any);
            },
          }));
          setResults(mapped);
          setActiveIdx(0);
          setLoading(false);
          return;
        }

        // Plain query: unified auto-suggest. Creators lead (real people search
        // is what users reach for), then communities and agents, then a few
        // post hits. Communities + agents have no server search endpoint, so we
        // pull a page and filter by name client-side. Each lane is capped so the
        // palette stays scannable and Enter still falls through to Discover.
        const qLower = q.toLowerCase();
        const [profilesRes, commRes, agentsRes, postsRes] = await Promise.all([
          // Pull a wider pool so the client can rank deterministically — with
          // limit:5 the server's tie-broken top-5 reshuffles between identical
          // searches. We rank + slice locally instead.
          sdk.profiles.search({ q, limit: 20, organization_id: ORG_ID || undefined } as any).catch(() => ({ data: [] })),
          sdk.communities.list({ limit: 50, organization_id: ORG_ID || undefined }).catch(() => ({ data: [] })),
          (sdk as any).agents.listDiscoverable({ limit: 50 }).catch(() => ({ data: [] })),
          sdk.posts.search({ q, limit: 4, organization_id: ORG_ID || undefined }).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;

        // STABLE relevance rank: exact handle/name, then prefix, then contains;
        // ties broken by handle length then id so the same query is deterministic.
        const rankProfile = (p: any) => {
          const un = (p.username || '').toLowerCase();
          const nm = (p.name || '').toLowerCase();
          if (un === qLower) return 0;
          if (nm === qLower) return 1;
          if (un.startsWith(qLower)) return 2;
          if (nm.startsWith(qLower)) return 3;
          if (un.includes(qLower)) return 4;
          if (nm.includes(qLower)) return 5;
          return 6;
        };
        const rankedProfiles = [...(profilesRes.data || [])].sort((a: any, b: any) =>
          rankProfile(a) - rankProfile(b)
          || (a.username || '').length - (b.username || '').length
          || String(a.id).localeCompare(String(b.id))
        ).slice(0, 5);
        const profileRows: Result[] = rankedProfiles.map((p: any) => ({
          kind: 'user',
          id: p.id,
          title: p.name || p.username || 'Unknown',
          subtitle: p.username ? `@${p.username}` : 'Creator',
          avatar: p.image || p.avatar,
          onPress: () => {
            pushRecent(q);
            close();
            router.push(`/(tabs)/user/${p.username || p.id}` as any);
          },
        }));

        const communityRows: Result[] = (commRes.data || [])
          .filter((c: any) =>
            (c.name || '').toLowerCase().includes(qLower) ||
            (c.description || c.bio || '').toLowerCase().includes(qLower))
          .slice(0, 4)
          .map((c: any) => ({
            kind: 'community' as const,
            id: `community:${c.id}`,
            title: c.name || 'Community',
            subtitle: 'Community',
            avatar: c.image || c.avatar,
            onPress: () => {
              pushRecent(q);
              close();
              router.push(`/(tabs)/community/${c.slug || c.id}` as any);
            },
          }));

        const agentRows: Result[] = (agentsRes.data || [])
          .filter((a: any) =>
            (a.name || '').toLowerCase().includes(qLower) ||
            (a.username || '').toLowerCase().includes(qLower))
          .slice(0, 4)
          .map((a: any) => ({
            kind: 'agent' as const,
            id: `agent:${a.id}`,
            title: a.name || a.username || 'Agent',
            subtitle: 'Agent',
            avatar: a.image || a.avatar,
            onPress: () => {
              pushRecent(q);
              close();
              router.push(`/(tabs)/user/${a.username || a.id}` as any);
            },
          }));

        const postRows: Result[] = (postsRes.data || []).map((p: any) => ({
          kind: 'post' as const,
          id: `post:${p.id}`,
          title: (p.title || p.content || '').slice(0, 100),
          subtitle: p.author?.name ? `Post by ${p.author.name}` : 'Post',
          onPress: () => {
            pushRecent(q);
            close();
            router.push(`/(tabs)/post/${p.id}` as any);
          },
        }));

        setResults([...profileRows, ...communityRows, ...agentRows, ...postRows]);
        setActiveIdx(0);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, query, sdk, router, close, runFind]);

  const onKeyDown = React.useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    if (e.key === 'ArrowDown') {
      e.preventDefault?.();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault?.();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
  }, [results.length]);

  const onSubmit = React.useCallback(() => {
    const q = query.trim();
    const r = results[activeIdx];
    // If the user is actively pointing at a live suggestion (a creator,
    // community, agent, post, or recent), open it. Otherwise Enter always jumps
    // to Discover for the typed query — including while results are still
    // resolving during the debounce, so a fast typist never lands on a stale row.
    if (r && !loading && r.kind !== 'command') {
      r.onPress();
      return;
    }
    if (q) runFind(q);
  }, [results, activeIdx, query, loading, runFind]);

  if (Platform.OS !== 'web') {
    // Native gets a different palette UX (bottom sheet) — kept simple
    // for now so this PR doesn't grow. Cmd+K is a desktop affordance
    // anyway; mobile relies on the per-screen search bars.
    return null;
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <Pressable
        onPress={close}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          alignItems: 'center',
          paddingTop: 80,
        }}
      >
        <KeyboardAvoidingView behavior="padding" style={{ width: '100%', alignItems: 'center' }}>
          <Pressable
            onPress={() => { /* swallow */ }}
            style={{
              width: '92%',
              maxWidth: 640,
              backgroundColor: colors.bg,
              borderRadius: radius.lg,
              borderWidth: 0.5,
              borderColor: colors.borderSubtle,
              overflow: 'hidden',
            } as any}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomWidth: 0.5,
                borderBottomColor: colors.borderSubtle,
                gap: spacing.sm,
              }}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                ref={inputRef}
                placeholder="Search creators, communities, agents…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={onSubmit}
                onKeyPress={onKeyDown}
                style={{
                  flex: 1,
                  color: colors.text,
                  ...typography.body,
                  paddingVertical: 6,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
                }}
                autoFocus
              />
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  borderWidth: 0.5,
                  borderColor: colors.borderSubtle,
                }}
              >
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>esc</Text>
              </View>
            </View>
            <FlatList
              data={results}
              keyExtractor={(r) => r.id}
              keyboardShouldPersistTaps="always"
              style={{ maxHeight: 420 }}
              ListEmptyComponent={
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <Text variant="body" color={colors.textMuted}>
                    {loading ? 'Searching…' : query ? 'No matches' : 'Type to search'}
                  </Text>
                </View>
              }
              renderItem={({ item, index }) => {
                const isActive = index === activeIdx;
                return (
                  <Pressable
                    onPress={item.onPress}
                    onHoverIn={() => setActiveIdx(index)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: isActive ? colors.surfaceHover : 'transparent',
                      gap: spacing.md,
                    }}
                  >
                    {item.avatar ? (
                      <Avatar uri={item.avatar} name={item.title} size="sm" />
                    ) : (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: colors.surfaceRaised,
                        }}
                      >
                        <Ionicons
                          name={
                            item.kind === 'command' ? 'flash-outline'
                              : item.kind === 'recent' ? 'time-outline'
                                : item.kind === 'post' ? 'document-text-outline'
                                  : item.kind === 'community' ? 'people-outline'
                                    : item.kind === 'agent' ? 'sparkles-outline'
                                      : 'person-outline'
                          }
                          size={14}
                          color={colors.textMuted}
                        />
                      </View>
                    )}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>{item.title}</Text>
                      {item.subtitle ? (
                        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{item.subtitle}</Text>
                      ) : null}
                    </View>
                    {isActive ? (
                      <Text variant="caption" color={colors.textMuted}>↵</Text>
                    ) : null}
                  </Pressable>
                );
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.lg,
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderTopWidth: 0.5,
                borderTopColor: colors.borderSubtle,
              }}
            >
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>↑ ↓ navigate</Text>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>↵ open</Text>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>esc close</Text>
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10, marginLeft: 'auto' as any }}>
                {user?.name || ''}
              </Text>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
