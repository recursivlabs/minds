import * as React from 'react';
import { View, Modal, Pressable, TextInput, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { showToast } from './Toast';
import { useAuth } from '../lib/auth';
import { ORG_ID } from '../lib/recursiv';
import { invalidate } from '../lib/cache';
import { useProfiles, useAgents } from '../lib/hooks';
import { spacing, radius, shadows } from '../constants/theme';
import { useColors } from '../lib/theme';

// A single addressable target — either a real person or an AI agent. Both are
// reachable through chat.dm({ user_id }) because agents are addressable as
// users on the platform.
type Target = {
  id: string;
  name: string;
  username?: string | null;
  avatar?: string | null;
  kind: 'person' | 'agent';
};

const norm = (s: string) => (s || '').toLowerCase().trim();

/**
 * Start-a-new-DM compose, modeled on Signal/iMessage: a search field that
 * matches BOTH people and agents, shows auto-suggested results when empty
 * (recent/active/followed surface first via the existing list hooks), and
 * opens a thread on a single tap. Reuses useProfiles/useAgents for the
 * suggested list and profiles.search + agents.listDiscoverable for live query.
 */
export function NewChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();

  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<Target[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [opening, setOpening] = React.useState<string | null>(null);

  // Suggested defaults (empty-query state): people + agents already loaded for
  // discovery. These are ordered by the platform's own relevance (active /
  // recent first), so they make sensible "who you'd message" suggestions.
  const { profiles } = useProfiles(visible ? 20 : 0);
  const { agents } = useAgents(visible ? 20 : 0);

  const suggested = React.useMemo<Target[]>(() => {
    const people: Target[] = (profiles || [])
      .filter((p: any) => (p.id ?? p.userId) && (p.id ?? p.userId) !== user?.id)
      .map((p: any) => ({ id: p.id ?? p.userId, name: p.name || p.username || 'User', username: p.username, avatar: p.image || p.avatar || null, kind: 'person' as const }));
    const agentTargets: Target[] = (agents || [])
      .map((a: any) => ({ id: a.id, name: a.name || a.username || 'Agent', username: a.username, avatar: a.image || a.avatar || null, kind: 'agent' as const }));
    // Interleave so agents are visible without being buried under a long people
    // list; de-dupe by id (an agent that's also a project member can appear in both).
    const seen = new Set<string>();
    const merged: Target[] = [];
    for (const t of [...agentTargets, ...people]) {
      if (t.id && !seen.has(t.id)) { seen.add(t.id); merged.push(t); }
    }
    return merged;
  }, [profiles, agents, user?.id]);

  // Reset transient state each time the modal opens.
  React.useEffect(() => {
    if (visible) { setQuery(''); setResults([]); setOpening(null); }
  }, [visible]);

  // Live search: people via profiles.search, agents via the discoverable list
  // (no dedicated agent-search endpoint) filtered client-side. Debounced so
  // typing doesn't fan out a request per keystroke.
  React.useEffect(() => {
    if (!visible) return;
    const q = query.trim();
    if (!q) { setResults([]); setSearching(false); return; }
    if (!sdk) return;
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const [profRes, agentRes] = await Promise.all([
          sdk.profiles.search
            ? sdk.profiles.search({ q, limit: 15, organization_id: ORG_ID || undefined } as any).catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
          sdk.agents.listDiscoverable({ limit: 50 }).catch(() => ({ data: [] })),
        ]);
        if (cancelled) return;
        const people: Target[] = (profRes.data || [])
          .filter((p: any) => (p.id ?? p.userId) && (p.id ?? p.userId) !== user?.id && !p.isAi && !p.is_ai && p.type !== 'agent')
          .map((p: any) => ({ id: p.id ?? p.userId, name: p.name || p.username || 'User', username: p.username, avatar: p.image || p.avatar || null, kind: 'person' as const }));
        const ql = norm(q);
        const agentMatches: Target[] = (agentRes.data || [])
          .filter((a: any) => norm(a.name).includes(ql) || norm(a.username).includes(ql))
          .map((a: any) => ({ id: a.id, name: a.name || a.username || 'Agent', username: a.username, avatar: a.image || a.avatar || null, kind: 'agent' as const }));
        const seen = new Set<string>();
        const merged: Target[] = [];
        for (const r of [...agentMatches, ...people]) {
          if (r.id && !seen.has(r.id)) { seen.add(r.id); merged.push(r); }
        }
        setResults(merged);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, sdk, visible, user?.id]);

  const openChat = React.useCallback(async (target: Target) => {
    if (!sdk || opening) return;
    setOpening(target.id);
    try {
      const res = await sdk.chat.dm({ user_id: target.id, organization_id: ORG_ID || undefined } as any);
      const convoId = res.data?.id;
      if (!convoId) { showToast('Could not start conversation', 'error'); setOpening(null); return; }
      // Force the sidebar/list to pick up the new thread without waiting on the
      // WS round-trip.
      invalidate('conversations');
      onClose();
      router.push({ pathname: '/(tabs)/chat', params: { id: convoId } } as any);
    } catch {
      showToast('Could not start conversation', 'error');
    } finally {
      setOpening(null);
    }
  }, [sdk, opening, onClose, router]);

  const list = query.trim() ? results : suggested;
  const showEmpty = !searching && query.trim().length > 0 && results.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: colors.scrimStrong, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.bg,
            borderRadius: radius.xl,
            width: '100%',
            maxWidth: 460,
            maxHeight: '80%',
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            ...shadows.lg(colors.shadow),
          }}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
            <Text variant="h3">New message</Text>
            <Pressable onPress={onClose} hitSlop={8} style={({ hovered }: any) => ({ padding: spacing.xs, borderRadius: radius.full, backgroundColor: hovered ? colors.glass : 'transparent', ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}) })}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {/* Search field */}
          <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.md }}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                placeholder="Search people or agents…"
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                {...(Platform.OS === 'web' ? { 'data-form-type': 'other', 'data-lpignore': 'true', name: 'new-chat-search' } as any : {})}
                style={{ flex: 1, paddingVertical: 10, color: colors.text, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />
              {searching ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
            </View>
          </View>

          {/* Results / suggestions */}
          <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!query.trim() && list.length > 0 && (
              <Text variant="caption" color={colors.textMuted} style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xs, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Suggested
              </Text>
            )}
            {list.map((target) => (
              <Pressable
                key={`${target.kind}-${target.id}`}
                onPress={() => openChat(target)}
                disabled={!!opening}
                style={({ pressed, hovered }: any) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.sm + 2,
                  backgroundColor: pressed ? colors.surfaceHover : hovered ? colors.glass : 'transparent',
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Avatar uri={target.avatar} name={target.name} size="sm" />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Text variant="bodyMedium" numberOfLines={1}>{target.name}</Text>
                    {target.kind === 'agent' && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: radius.full, backgroundColor: colors.accentSubtle }}>
                        <Ionicons name="sparkles" size={9} color={colors.accent} />
                        <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>Agent</Text>
                      </View>
                    )}
                  </View>
                  {target.username ? (
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 12 }}>@{target.username}</Text>
                  ) : null}
                </View>
                {opening === target.id ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
                )}
              </Pressable>
            ))}

            {showEmpty && (
              <View style={{ alignItems: 'center', paddingVertical: spacing['2xl'], gap: spacing.sm }}>
                <Ionicons name="search-outline" size={28} color={colors.textMuted} />
                <Text variant="caption" color={colors.textMuted}>No people or agents match “{query.trim()}”.</Text>
              </View>
            )}
            <View style={{ height: spacing.md }} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
