import * as React from 'react';
import { View, ScrollView, FlatList, TextInput, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, Text, CommunityCard, AgentCard, PostCard, Skeleton, Card, Button, UserCard } from '../../components';
import { Container } from '../../components/Container';
import { useCommunities, useAgents, useSearchPosts, useProfiles } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        marginBottom: spacing.lg,
      }}
    >
      <Text variant="h3">{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="label" color={colors.accent}>See all</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.accent} />
        </Pressable>
      )}
    </View>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const [query, setQuery] = React.useState('');
  const { communities, loading: commLoading } = useCommunities(10);
  const { agents, loading: agentsLoading } = useAgents(6);
  const { profiles, loading: profilesLoading } = useProfiles(10);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  const isSearching = query.trim().length > 0;

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try {
      await sdk.profiles.follow(userId);
    } catch {}
  };

  return (
    <Container safeTop padded={false}>
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
              <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
                <Ionicons name="search-outline" size={40} color={colors.textMuted} />
                <Text variant="body" color={colors.textMuted} align="center">
                  No results found
                </Text>
                <Button onPress={() => setQuery('')} size="sm" variant="secondary">
                  Clear search
                </Button>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Trending Communities */}
          <View style={{ paddingTop: spacing.lg }}>
            <SectionHeader
              title="Trending Communities"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'communities' } })}
            />

            {commLoading ? (
              <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md }}>
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} width={200} height={140} borderRadius={14} />
                ))}
              </View>
            ) : communities.length === 0 ? (
              <View style={{ paddingHorizontal: spacing.xl }}>
                <Card variant="raised">
                  <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
                    <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                    <Text variant="body" color={colors.textMuted}>
                      No communities yet
                    </Text>
                    <Button onPress={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'communities' } })} size="sm">
                      Create a community
                    </Button>
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

          {/* Trending Agents */}
          <View style={{ paddingTop: spacing['3xl'] }}>
            <SectionHeader
              title="Trending Agents"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'agents' } })}
            />

            {agentsLoading ? (
              <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md }}>
                {[1, 2].map(i => (
                  <Skeleton key={i} width={200} height={140} borderRadius={14} />
                ))}
              </View>
            ) : agents.length === 0 ? (
              <View style={{ paddingHorizontal: spacing.xl }}>
                <Card variant="raised">
                  <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
                    <Ionicons name="sparkles-outline" size={32} color={colors.textMuted} />
                    <Text variant="body" color={colors.textMuted}>
                      No agents yet
                    </Text>
                    <Button onPress={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'agents' } })} size="sm">
                      Explore the platform
                    </Button>
                  </View>
                </Card>
              </View>
            ) : (
              <FlatList
                horizontal
                data={agents}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={{ width: 240, marginRight: spacing.md }}>
                    <AgentCard
                      agent={item}
                      onChat={() => {
                        console.log('Chat with agent:', item.id);
                      }}
                    />
                  </View>
                )}
                contentContainerStyle={{ paddingHorizontal: spacing.xl }}
                showsHorizontalScrollIndicator={false}
              />
            )}
          </View>

          {/* Apps */}
          <View style={{ paddingTop: spacing['3xl'] }}>
            <SectionHeader
              title="Apps"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'apps' } })}
            />
            <View style={{ paddingHorizontal: spacing.xl }}>
              <Card variant="raised">
                <View style={{ alignItems: 'center', padding: spacing.xl }}>
                  <Ionicons name="apps-outline" size={40} color={colors.textMuted} />
                  <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                    No apps yet — build one!
                  </Text>
                  <Text
                    variant="caption"
                    color={colors.textMuted}
                    align="center"
                    style={{ marginTop: spacing.xs }}
                  >
                    Build apps on the Minds platform
                  </Text>
                  <View style={{ marginTop: spacing.lg }}>
                    <Button onPress={() => {}} size="sm">
                      Build Your First App
                    </Button>
                  </View>
                </View>
              </Card>
            </View>
          </View>

          {/* Discover People */}
          <View style={{ paddingTop: spacing['3xl'], paddingBottom: spacing['4xl'] }}>
            <SectionHeader
              title="Discover People"
              onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'people' } })}
            />

            {profilesLoading ? (
              <View style={{ flexDirection: 'row', paddingHorizontal: spacing.xl, gap: spacing.md }}>
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} width={160} height={160} borderRadius={14} />
                ))}
              </View>
            ) : profiles.length === 0 ? (
              <View style={{ paddingHorizontal: spacing.xl }}>
                <Card variant="raised">
                  <View style={{ alignItems: 'center', padding: spacing.lg, gap: spacing.md }}>
                    <Ionicons name="person-outline" size={32} color={colors.textMuted} />
                    <Text variant="body" color={colors.textMuted}>
                      Be the first! Invite your friends
                    </Text>
                    <Button onPress={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'people' } })} size="sm" variant="secondary">
                      Invite friends
                    </Button>
                  </View>
                </Card>
              </View>
            ) : (
              <FlatList
                horizontal
                data={profiles}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <UserCard user={item} onFollow={handleFollow} compact />
                )}
                contentContainerStyle={{ paddingHorizontal: spacing.xl }}
                showsHorizontalScrollIndicator={false}
              />
            )}
          </View>
        </ScrollView>
      )}
    </Container>
  );
}
