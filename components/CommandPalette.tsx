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
import { colors, spacing, radius, typography } from '../constants/theme';

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
    router.push(`/(tabs)/discover?q=${encodeURIComponent(q)}` as any);
  }, [router, close]);

  const runPost = React.useCallback(() => {
    close();
    router.push('/(tabs)/create' as any);
  }, [router, close]);

  const runDm = React.useCallback(async (username: string) => {
    if (!sdk) return;
    try {
      const profileRes = await sdk.profiles.getByUsername(username);
      const userId = profileRes.data?.id;
      if (!userId) return;
      const dm = await sdk.chat.dm({ user_id: userId });
      if (dm.data?.id) {
        close();
        router.push(`/(tabs)/chat?id=${dm.data.id}` as any);
      }
    } catch {}
  }, [sdk, router, close]);

  const runAskAgent = React.useCallback(async (prompt: string) => {
    if (!sdk) return;
    try {
      const list = await sdk.agents.list({ limit: 50 });
      const personal = (list.data || []).find(
        (a: any) => a.agent_type === 'personal' || a.agentType === 'personal',
      );
      if (!personal) {
        close();
        router.push('/agent' as any);
        return;
      }
      const dm = await sdk.chat.dm({ user_id: personal.id });
      const convoId = dm.data?.id;
      if (!convoId) return;
      // Send the prompt as a user message right away so the agent
      // sees it on open. (The DM screen will pick up the WS broadcast.)
      try {
        await sdk.chat.send({ conversation_id: convoId, content: prompt });
      } catch {}
      close();
      router.push(`/(tabs)/chat?id=${convoId}` as any);
    } catch {}
  }, [sdk, router, close]);

  const runSwitch = React.useCallback(async (name: string) => {
    if (!sdk) return;
    try {
      const list = await sdk.communities.list({ limit: 100, organization_id: ORG_ID || undefined });
      const match = (list.data || []).find(
        (c: any) => c.slug === name || c.name?.toLowerCase() === name.toLowerCase(),
      );
      if (match) {
        close();
        router.push(`/(tabs)/community/${match.slug || match.id}` as any);
      }
    } catch {}
  }, [sdk, router, close]);

  // Debounced search + slash parser. Runs when query changes.
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
      const suggestions: Result[] = [
        {
          kind: 'command',
          id: 'cmd:post',
          title: 'Write a post',
          subtitle: '/post',
          onPress: runPost,
        },
        {
          kind: 'command',
          id: 'cmd:ask',
          title: 'Ask your agent',
          subtitle: '/ask <question>',
          onPress: () => inputRef.current?.setNativeProps({ text: '/ask ' }),
        },
      ];
      setResults([...recents, ...suggestions]);
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

        // Slash-command preview rows: render the command itself as a
        // result so Enter from the preview runs the action.
        const slashPreview: Result[] = [];
        if (q.startsWith('/find ') || q === '/find') {
          const rest = q.replace(/^\/find\s*/, '');
          slashPreview.push({
            kind: 'command',
            id: 'cmd:find',
            title: rest ? `Find "${rest}"` : 'Find…',
            subtitle: '/find',
            onPress: () => runFind(rest || ''),
          });
        }
        if (q === '/post' || q.startsWith('/post')) {
          slashPreview.push({
            kind: 'command',
            id: 'cmd:post',
            title: 'Write a post',
            subtitle: '/post',
            onPress: runPost,
          });
        }
        if (q.startsWith('/dm ') || q === '/dm') {
          const rest = q.replace(/^\/dm\s*@?/, '').trim();
          slashPreview.push({
            kind: 'command',
            id: 'cmd:dm',
            title: rest ? `DM @${rest}` : 'DM…',
            subtitle: '/dm',
            onPress: () => rest ? runDm(rest) : undefined,
          });
        }
        if (q.startsWith('/ask ') || q === '/ask') {
          const rest = q.replace(/^\/ask\s*/, '').trim();
          slashPreview.push({
            kind: 'command',
            id: 'cmd:ask',
            title: rest ? `Ask your agent: "${rest}"` : 'Ask your agent…',
            subtitle: '/ask',
            onPress: () => rest ? runAskAgent(rest) : undefined,
          });
        }
        if (q.startsWith('/switch ') || q === '/switch') {
          const rest = q.replace(/^\/switch\s*/, '').trim();
          slashPreview.push({
            kind: 'command',
            id: 'cmd:switch',
            title: rest ? `Switch to ${rest}` : 'Switch community…',
            subtitle: '/switch',
            onPress: () => rest ? runSwitch(rest) : undefined,
          });
        }
        if (slashPreview.length > 0) {
          if (cancelled) return;
          setResults(slashPreview);
          setActiveIdx(0);
          setLoading(false);
          return;
        }

        // Plain query: unified search across posts + profiles. Limit
        // each lane to a handful so the palette stays scannable.
        const [postsRes, profilesRes] = await Promise.all([
          sdk.posts.search({ q, limit: 6, organization_id: ORG_ID || undefined }).catch(() => ({ data: [] })),
          sdk.profiles.search({ q, limit: 4 }).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        const postRows: Result[] = (postsRes.data || []).map((p: any) => ({
          kind: 'post',
          id: p.id,
          title: (p.title || p.content || '').slice(0, 100),
          subtitle: p.author?.name ? `Post by ${p.author.name}` : 'Post',
          avatar: undefined,
          onPress: () => {
            close();
            router.push(`/(tabs)/post/${p.id}` as any);
          },
        }));
        const profileRows: Result[] = (profilesRes.data || []).map((p: any) => ({
          kind: 'user',
          id: p.id,
          title: p.name || p.username || 'Unknown',
          subtitle: p.username ? `@${p.username}` : undefined,
          avatar: p.image,
          onPress: () => {
            close();
            router.push(`/(tabs)/user/${p.username || p.id}` as any);
          },
        }));
        setResults([...profileRows, ...postRows]);
        setActiveIdx(0);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, query, sdk, router, close, runFind, runPost, runDm, runAskAgent, runSwitch]);

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
    const r = results[activeIdx];
    if (r) {
      r.onPress();
    } else if (query.trim()) {
      // Fallback: enter a search if no result is highlighted.
      runFind(query.trim());
    }
  }, [results, activeIdx, query, runFind]);

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
                placeholder="Search, or type / for actions…"
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
