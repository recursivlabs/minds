import * as React from 'react';
import { View, FlatList, Pressable, TextInput, Platform, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Button, PostCard, Skeleton } from '../../../components';
import { useAuth } from '../../../lib/auth';
import { ORG_ID } from '../../../lib/recursiv';
import { colors, spacing, radius, typography } from '../../../constants/theme';

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();

  const [community, setCommunity] = React.useState<any>(null);
  const [posts, setPosts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [isMember, setIsMember] = React.useState(false);
  const [joinLoading, setJoinLoading] = React.useState(false);

  React.useEffect(() => {
    if (!id || !sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.communities.get(id);
        if (!cancelled) {
          setCommunity(res.data);
          setIsMember((res.data as any)?.isMember || (res.data as any)?.is_member || false);
        }
      } catch {}
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, sdk]);

  React.useEffect(() => {
    if (!id || !sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.posts.list({ limit: 30, organization_id: ORG_ID || undefined });
        const communityPosts = (res.data || []).filter(
          (p: any) => p.communityId === id || p.community_id === id
        );
        if (!cancelled) setPosts(communityPosts);
      } catch {}
      finally { if (!cancelled) setPostsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, sdk]);

  const handleJoinLeave = async () => {
    if (!sdk || !id) return;
    setJoinLoading(true);
    const wasMember = isMember;
    setIsMember(!wasMember);
    try {
      if (wasMember) await sdk.communities.leave(id);
      else await sdk.communities.join(id);
    } catch {
      setIsMember(wasMember);
    } finally {
      setJoinLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ padding: spacing.xl, gap: spacing.lg, alignItems: 'center' }}>
          <Skeleton width={56} height={56} borderRadius={28} />
          <Skeleton width={180} height={20} />
        </View>
      </View>
    );
  }

  if (!community) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3">Community</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={colors.textMuted}>Community not found</Text>
        </View>
      </View>
    );
  }

  const memberCount = community.memberCount || community.member_count || 0;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }} numberOfLines={1}>
          {community.name}
        </Text>
      </View>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ padding: spacing.xl, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Avatar uri={community.image || community.avatar} name={community.name} size="xl" />
              <View style={{ flex: 1 }}>
                <Text variant="h2">{community.name}</Text>
                <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
                  {memberCount} member{memberCount !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {community.description && (
              <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                {community.description}
              </Text>
            )}

            <Button
              onPress={handleJoinLeave}
              loading={joinLoading}
              variant={isMember ? 'secondary' : 'primary'}
              size="sm"
            >
              {isMember ? 'Leave' : 'Join'}
            </Button>

            <View
              style={{
                borderBottomWidth: 0.5,
                borderBottomColor: 'rgba(255,255,255,0.06)',
                paddingBottom: spacing.md,
              }}
            />
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} />}
        ListEmptyComponent={
          !postsLoading ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
              <Text variant="body" color={colors.textMuted}>
                No posts in this community yet
              </Text>
              {isMember && (
                <Text variant="caption" color={colors.accent}>
                  Be the first to post!
                </Text>
              )}
            </View>
          ) : (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
