import * as React from 'react';
import { View, ScrollView, FlatList, TextInput, Platform, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Skeleton, Button } from '../../components';
import { Container } from '../../components/Container';
import { usePosts, useCommunities, useAgents, useSearchPosts, useProfiles } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg, marginTop: spacing['2xl'] }}>
      <Text variant="h3" style={{ fontSize: 18, fontWeight: '600' }}>{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text variant="caption" color={colors.accent}>See all</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Featured post — large card with content preview */
function FeaturedPost({ post, onPress }: { post: any; onPress: () => void }) {
  const author = post.author?.name || 'Anonymous';
  const authorAvatar = post.author?.image || post.author?.avatar;
  const content = post.content || '';
  const title = post.title;
  const score = (post.upvoteCount || 0) - (post.downvoteCount || 0);
  const replyCount = post.replyCount || post.reply_count || 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.glassBorder,
        padding: spacing.xl,
        marginBottom: spacing.md,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
        <Avatar uri={authorAvatar} name={author} size="sm" />
        <Text variant="bodyMedium" style={{ fontSize: 13 }}>{author}</Text>
      </View>
      {title && <Text variant="h3" numberOfLines={2} style={{ marginBottom: spacing.sm }}>{title}</Text>}
      <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ lineHeight: 22 }}>
        {content.slice(0, 300)}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginTop: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="arrow-up-outline" size={14} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>{score}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>{replyCount}</Text>
        </View>
      </View>
    </Pressable>
  );
}

/** Person card — horizontal, shows bio */
function PersonCard({ person, onPress, onFollow }: { person: any; onPress: () => void; onFollow: () => void }) {
  const name = person.name || 'Unknown';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.glassBorder,
        padding: spacing.lg,
        width: 260,
        marginRight: spacing.md,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
          {username && <Text variant="caption" color={colors.textMuted}>@{username}</Text>}
        </View>
      </View>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 18, marginBottom: spacing.sm }}>
          {bio}
        </Text>
      ) : null}
      <Pressable
        onPress={(e) => { e.stopPropagation?.(); onFollow(); }}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.xs + 2,
          borderRadius: radius.full,
          backgroundColor: colors.accentMuted,
        }}
      >
        <Text variant="caption" color={colors.accent} style={{ fontWeight: '500' }}>Follow</Text>
      </Pressable>
    </Pressable>
  );
}

/** Community card — horizontal, shows description + member count */
function CommunityCard({ community, onPress }: { community: any; onPress: () => void }) {
  const name = community.name || 'Unnamed';
  const description = community.description || community.bio || '';
  const avatar = community.image || community.avatar;
  const memberCount = community.memberCount || community.member_count || 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.glassBorder,
        padding: spacing.lg,
        width: 280,
        marginRight: spacing.md,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
          <Text variant="caption" color={colors.textMuted}>{memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
        </View>
      </View>
      {description ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 18 }}>
          {description}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Agent card — horizontal, shows bio + model */
function AgentCard({ agent, onPress }: { agent: any; onPress: () => void }) {
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || '';
  const avatar = agent.image || agent.avatar;
  const model = agent.model?.split('/').pop() || '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.glassBorder,
        padding: spacing.lg,
        width: 260,
        marginRight: spacing.md,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="bodyMedium" numberOfLines={1} style={{ flex: 1 }}>{name}</Text>
            <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
              <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
            </View>
          </View>
          {model ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Ionicons name="hardware-chip-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{model}</Text>
            </View>
          ) : null}
        </View>
      </View>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 18 }}>
          {bio}
        </Text>
      ) : null}
    </Pressable>
  );
}

export default function ExploreScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const [query, setQuery] = React.useState('');

  const { posts, loading: postsLoading } = usePosts('score', 10);
  const { communities, loading: commLoading } = useCommunities(10);
  const { agents, loading: agentsLoading } = useAgents(10);
  const { profiles, loading: profilesLoading } = useProfiles(10);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(query);

  const isSearching = query.trim().length > 0;

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try { await sdk.profiles.follow(userId); } catch {}
  };

  // Filter out business AI agent from explore
  const HIDDEN_AGENT_IDS = ['411ac3a9-dfbc-4463-8963-2e26a645211e'];
  const visibleAgents = (agents || []).filter((a: any) => !HIDDEN_AGENT_IDS.includes(a.id));

  return (
    <Container safeTop padded={false}>
      {/* Search bar */}
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            paddingHorizontal: spacing.md,
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
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {isSearching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/(tabs)/post/${item.id}` as any)}
              style={({ pressed }) => ({
                paddingVertical: spacing.lg,
                paddingHorizontal: spacing.md,
                borderBottomWidth: 0.5,
                borderBottomColor: 'rgba(255,255,255,0.06)',
                backgroundColor: pressed ? colors.surfaceHover : 'transparent',
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                <Avatar uri={item.author?.image} name={item.author?.name} size="xs" />
                <Text variant="caption" color={colors.textMuted}>{item.author?.name || 'Anonymous'}</Text>
              </View>
              <Text variant="bodyMedium" numberOfLines={2}>
                {item.title || item.content?.slice(0, 120) || 'Untitled'}
              </Text>
              {!item.title && item.content && (
                <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ marginTop: spacing.xs }}>
                  {item.content.slice(0, 100)}
                </Text>
              )}
            </Pressable>
          )}
          ListHeaderComponent={
            <Text variant="caption" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
              {searchLoading ? 'Searching...' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`}
            </Text>
          }
          ListEmptyComponent={
            !searchLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
                <Ionicons name="search-outline" size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">No Results</Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  Try searching for something else.
                </Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['4xl'] }}
        >
          {/* Featured Posts — large cards, not tiny horizontal */}
          <SectionHeader
            title="Trending"
            onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'posts' } })}
          />
          {postsLoading ? (
            <View style={{ gap: spacing.md }}>
              {[1, 2].map(i => <Skeleton key={i} height={140} borderRadius={radius.lg} />)}
            </View>
          ) : posts.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.lg }}>
              <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
              <Text variant="h2" color={colors.text} align="center">Trending</Text>
              <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300, lineHeight: 24 }}>
                Be the first to post and start the conversation.
              </Text>
              <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create a post</Button>
            </View>
          ) : (
            posts.slice(0, 5).map((post: any) => (
              <FeaturedPost
                key={post.id}
                post={post}
                onPress={() => router.push(`/(tabs)/post/${post.id}` as any)}
              />
            ))
          )}

          {/* People — rich cards with bio */}
          <SectionHeader
            title="People to Follow"
            onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'people' } })}
          />
          {profilesLoading ? (
            <View style={{ flexDirection: 'row' }}>
              {[1, 2].map(i => <Skeleton key={i} width={260} height={120} borderRadius={radius.lg} style={{ marginRight: spacing.md }} />)}
            </View>
          ) : profiles.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.lg }}>
              <Ionicons name="person-outline" size={40} color={colors.accent} />
              <Text variant="body" color={colors.textSecondary} align="center">No people to discover yet</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {profiles.slice(0, 10).map((u: any) => (
                <PersonCard
                  key={u.id}
                  person={u}
                  onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)}
                  onFollow={() => handleFollow(u.id)}
                />
              ))}
            </ScrollView>
          )}

          {/* Communities — rich cards with descriptions */}
          <SectionHeader
            title="Communities"
            onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'communities' } })}
          />
          {commLoading ? (
            <View style={{ flexDirection: 'row' }}>
              {[1, 2].map(i => <Skeleton key={i} width={280} height={100} borderRadius={radius.lg} style={{ marginRight: spacing.md }} />)}
            </View>
          ) : communities.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.lg }}>
              <Ionicons name="people-outline" size={40} color={colors.accent} />
              <Text variant="body" color={colors.textSecondary} align="center">No communities yet</Text>
              <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create one</Button>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {communities.slice(0, 10).map((c: any) => (
                <CommunityCard
                  key={c.id}
                  community={c}
                  onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
                />
              ))}
            </ScrollView>
          )}

          {/* Agents — rich cards with bio + model */}
          <SectionHeader
            title="AI Agents"
            onSeeAll={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'agents' } })}
          />
          {agentsLoading ? (
            <View style={{ flexDirection: 'row' }}>
              {[1, 2].map(i => <Skeleton key={i} width={260} height={100} borderRadius={radius.lg} style={{ marginRight: spacing.md }} />)}
            </View>
          ) : visibleAgents.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.lg }}>
              <Ionicons name="hardware-chip-outline" size={40} color={colors.accent} />
              <Text variant="body" color={colors.textSecondary} align="center">No agents yet</Text>
              <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create one</Button>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {visibleAgents.slice(0, 10).map((a: any) => (
                <AgentCard
                  key={a.id}
                  agent={a}
                  onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
                />
              ))}
            </ScrollView>
          )}
        </ScrollView>
      )}
    </Container>
  );
}
