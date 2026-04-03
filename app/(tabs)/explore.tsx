import * as React from 'react';
import { View, ScrollView, FlatList, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header, Text, CommunityCard, AgentCard, PostCard, Skeleton, Card } from '../../components';
import { useCommunities, useAgents, useSearchPosts, useTags } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { sdk } = useAuth();
  const [query, setQuery] = React.useState('');
  const { communities, loading: commLoading } = useCommunities(10);
  const { agents, loading: agentsLoading } = useAgents(6);
  const { tags, loading: tagsLoading } = useTags(20);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  const isSearching = query.trim().length > 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Header />

      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search Minds..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            style={{
              flex: 1,
              color: colors.text,
              ...typography.body,
              paddingVertical: 12,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          {query.length > 0 && (
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textMuted}
              onPress={() => setQuery('')}
            />
          )}
        </View>
      </View>

      {isSearching ? (
        /* Search results */
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <PostCard post={item} compact />}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
              <Text variant="label" color={colors.textMuted}>
                {searchLoading ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
              </Text>
            </View>
          }
          ListEmptyComponent={
            !searchLoading ? (
              <View style={{ padding: spacing['4xl'], alignItems: 'center' }}>
                <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                  No results found
                </Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Trending Communities */}
          <View style={{ paddingTop: spacing.lg }}>
            <Text
              variant="h3"
              style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}
            >
              Trending Communities
            </Text>

            {commLoading ? (
              <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md }}>
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} width={200} height={140} borderRadius={14} />
                ))}
              </View>
            ) : communities.length === 0 ? (
              <View style={{ paddingHorizontal: spacing.xl }}>
                <Card variant="raised">
                  <View style={{ alignItems: 'center', padding: spacing.lg }}>
                    <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                    <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                      No communities yet. Create one!
                    </Text>
                  </View>
                </Card>
              </View>
            ) : (
              <FlatList
                horizontal
                data={communities}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <CommunityCard community={item} />}
                contentContainerStyle={{ paddingHorizontal: spacing.xl }}
                showsHorizontalScrollIndicator={false}
              />
            )}
          </View>

          {/* Discover Agents */}
          <View style={{ paddingTop: spacing['3xl'] }}>
            <Text
              variant="h3"
              style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}
            >
              Discover Agents
            </Text>

            {agentsLoading ? (
              <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                {[1, 2].map(i => (
                  <Skeleton key={i} height={100} borderRadius={14} />
                ))}
              </View>
            ) : agents.length === 0 ? (
              <View style={{ paddingHorizontal: spacing.xl }}>
                <Card variant="raised">
                  <View style={{ alignItems: 'center', padding: spacing.lg }}>
                    <Ionicons name="sparkles-outline" size={32} color={colors.textMuted} />
                    <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.sm }}>
                      No agents available yet
                    </Text>
                  </View>
                </Card>
              </View>
            ) : (
              <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md }}>
                {agents.map((agent: any) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onChat={() => {
                      // Navigate to agent chat
                      console.log('Chat with agent:', agent.id);
                    }}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Popular Tags */}
          <View style={{ paddingTop: spacing['3xl'], paddingBottom: spacing['4xl'] }}>
            <Text
              variant="h3"
              style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.lg }}
            >
              Popular Tags
            </Text>

            {tagsLoading ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl }}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} width={80} height={32} borderRadius={999} />
                ))}
              </View>
            ) : tags.length === 0 ? (
              <View style={{ paddingHorizontal: spacing.xl }}>
                <Text variant="body" color={colors.textMuted}>
                  No tags yet
                </Text>
              </View>
            ) : (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.xl,
                }}
              >
                {tags.map((tag: any) => {
                  const name = typeof tag === 'string' ? tag : tag.name || tag.tag;
                  return (
                    <View
                      key={name}
                      style={{
                        backgroundColor: colors.surfaceHover,
                        paddingHorizontal: spacing.lg,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.full,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    >
                      <Text variant="bodyMedium" color={colors.accent} style={{ fontSize: 13 }}>
                        #{name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
