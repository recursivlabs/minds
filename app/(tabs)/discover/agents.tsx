import * as React from 'react';
import { View, FlatList } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../../components';
import { useAgents } from '../../../lib/hooks';
import { spacing } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { AgentRow, ListSkeleton } from '../../../lib/discover';

// ──────────────────────────────────────────────────────────────────────────
// Agents tab — leaderboard by popularity. The agent payload carries no
// engagement signal yet, so "popularity" falls back to native discoverable
// order, lifted by any usage/chat-count field when one exists. A query
// client-filters the loaded list (there's no agent search endpoint).
// ──────────────────────────────────────────────────────────────────────────

const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];

function popularity(a: any): number {
  return Number(
    a?.chatCount ?? a?.chat_count ?? a?.conversationCount ?? a?.conversation_count ??
    a?.usageCount ?? a?.usage_count ?? a?.followersCount ?? a?.followers_count ?? 0,
  );
}

export default function DiscoverAgents() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const colors = useColors();
  const query = (params.q || '').trim();
  const isSearching = query.length > 0;

  const { agents, loading } = useAgents(60);

  const ranked = React.useMemo(() => {
    let list = (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id));
    if (isSearching) {
      const q = query.toLowerCase();
      list = list.filter((a: any) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.bio || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q));
    }
    // Stable: keep native order, but lift any agent that has a real usage signal.
    return [...list].sort((a, b) => popularity(b) - popularity(a));
  }, [agents, isSearching, query]);

  const toAgent = (a: any) => router.push(`/(tabs)/user/${a.username || a.id}` as any);

  if (loading && (agents || []).length === 0) return <ListSkeleton />;

  return (
    <FlatList
      data={ranked}
      keyExtractor={(item: any, i) => `a-${item.id || i}`}
      renderItem={({ item }) => <AgentRow agent={item} onPress={() => toAgent(item)} />}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        ranked.length > 0 ? (
          <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
            <Text variant="caption" color={colors.textMuted}>
              {isSearching ? `${ranked.length} result${ranked.length !== 1 ? 's' : ''}` : `${ranked.length} agents you can chat with`}
            </Text>
          </View>
        ) : null
      }
      ListEmptyComponent={
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="hardware-chip-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">{isSearching ? 'No Results' : 'Discover Agents'}</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
            {isSearching ? 'Try a different search term.' : 'AI agents you can chat with show up here.'}
          </Text>
        </View>
      }
    />
  );
}
