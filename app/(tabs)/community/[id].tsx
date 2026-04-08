import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Button, PostCard, Skeleton } from '../../../components';
import { Container } from '../../../components/Container';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { ORG_ID } from '../../../lib/recursiv';
import { colors, spacing } from '../../../constants/theme';

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sdk, user } = useAuth();

  const [community, setCommunity] = React.useState<any>(null);
  const [posts, setPosts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [isMember, setIsMember] = React.useState(false);
  const [joinLoading, setJoinLoading] = React.useState(false);

  // Load community details
  React.useEffect(() => {
    if (!id || !sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.communities.get(id);
        if (!cancelled && res.data) {
          setCommunity(res.data);
          setIsMember(!!(res.data as any).is_member || !!(res.data as any).isMember);
        }
      } catch (err: any) {
        if (!cancelled) setCommunity(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, sdk]);

  // Load community posts — use community UUID from the loaded community data
  React.useEffect(() => {
    if (!sdk || !community?.id) return;
    let cancelled = false;
    (async () => {
      try {
        // Pass community_id as query param so server filters server-side
        const res = await sdk.posts.list({
          limit: 50,
          organization_id: ORG_ID || undefined,
          community_id: community.id,
        } as any);
        if (!cancelled) setPosts(res.data || []);
      } catch (e) { /* community posts fetch failed — show empty state */ }
      if (!cancelled) setPostsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sdk, community?.id]);

  const handleJoinLeave = async () => {
    if (!sdk || !community?.id) return;
    setJoinLoading(true);
    const wasMember = isMember;
    setIsMember(!wasMember);
    try {
      if (wasMember) await sdk.communities.leave(community.id);
      else await sdk.communities.join(community.id);
    } catch {
      setIsMember(wasMember);
    }
    setJoinLoading(false);
  };

  if (loading) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="" />
        <View style={{ padding: spacing.xl, gap: spacing.lg, alignItems: 'center' }}>
          <Skeleton width={56} height={56} borderRadius={28} />
          <Skeleton width={180} height={20} />
        </View>
      </Container>
    );
  }

  if (!community) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Community" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
          <Ionicons name="people-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text}>Community not found</Text>
          <Text variant="body" color={colors.textSecondary} style={{ maxWidth: 300, textAlign: 'center' }}>
            This community may have been removed or the link is incorrect.
          </Text>
        </View>
      </Container>
    );
  }

  const memberCount = community.member_count || community.memberCount || 0;
  const postCount = community.post_count || community.postCount || 0;

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title={community.name} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            {/* Community info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Avatar uri={community.image || community.avatar} name={community.name} size="xl" />
              <View style={{ flex: 1 }}>
                <Text variant="h2">{community.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>{memberCount}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="newspaper-outline" size={14} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>{postCount}</Text>
                  </View>
                </View>
              </View>
            </View>

            {community.description && (
              <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                {community.description}
              </Text>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <Button
                onPress={handleJoinLeave}
                loading={joinLoading}
                variant={isMember ? 'secondary' : 'primary'}
                size="sm"
              >
                {isMember ? 'Joined' : 'Join'}
              </Button>
              <Button
                onPress={() => router.push('/(tabs)/create')}
                variant="secondary"
                size="sm"
              >
                Create Post
              </Button>
            </View>

            {/* Separator */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }} />

            {/* Posts header */}
            <Text variant="label" color={colors.textMuted}>Posts</Text>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} compact />}
        ListEmptyComponent={
          !postsLoading ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
              <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
              <Text variant="h2" color={colors.text}>No posts yet</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
                Be the first to post in this community.
              </Text>
              <Button onPress={() => router.push('/(tabs)/create')} size="sm">
                Create Post
              </Button>
            </View>
          ) : (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </Container>
  );
}
