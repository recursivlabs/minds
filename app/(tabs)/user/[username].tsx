import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Button, Divider, PostCard, Skeleton } from '../../../components';
import { useAuth } from '../../../lib/auth';
import { useProfile } from '../../../lib/hooks';
import { ORG_ID } from '../../../lib/recursiv';
import { colors, spacing } from '../../../constants/theme';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { profile, loading, error, isFollowing, setIsFollowing } = useProfile(username);
  const [followLoading, setFollowLoading] = React.useState(false);
  const [userPosts, setUserPosts] = React.useState<any[]>([]);
  const [postsLoading, setPostsLoading] = React.useState(true);

  const isOwnProfile = user?.id === profile?.id;

  React.useEffect(() => {
    if (!profile?.id || !sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.posts.list({ limit: 50, organization_id: ORG_ID || undefined });
        const filtered = (res.data || []).filter(
          (p: any) => {
            const authorId = p.author?.id || p.userId || p.user_id;
            const authorUsername = p.author?.username;
            return authorId === profile.id || authorUsername === username;
          }
        );
        if (!cancelled) setUserPosts(filtered);
      } catch {}
      finally { if (!cancelled) setPostsLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [profile?.id, sdk, username]);

  const followerCount = profile?.followerCount || profile?.follower_count || 0;
  const followingCount = profile?.followingCount || profile?.following_count || 0;

  const handleToggleFollow = async () => {
    if (!sdk || !profile?.id) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    try {
      if (wasFollowing) await sdk.profiles.unfollow(profile.id);
      else await sdk.profiles.follow(profile.id);
    } catch {
      setIsFollowing(wasFollowing);
    } finally {
      setFollowLoading(false);
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
        <View style={{ padding: spacing['3xl'], gap: spacing.lg }}>
          <Skeleton width={80} height={80} borderRadius={40} />
          <Skeleton width={160} height={20} />
          <Skeleton width={120} height={14} />
        </View>
      </View>
    );
  }

  if (error || !profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3">User</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={colors.textMuted}>{error || 'User not found'}</Text>
        </View>
      </View>
    );
  }

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
        <Text variant="h3" style={{ flex: 1 }}>@{username}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: spacing['3xl'], paddingHorizontal: spacing.xl }}>
          <Avatar uri={profile.image || profile.avatar} name={profile.name} size="xl" />

          <Text variant="h2" style={{ marginTop: spacing.lg }}>
            {profile.name || username}
          </Text>
          <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            @{profile.username || username}
          </Text>

          {profile.bio && (
            <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.md, lineHeight: 22 }}>
              {profile.bio}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followingCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followerCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Followers</Text>
            </View>
          </View>

          {!isOwnProfile && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
              <Button
                onPress={handleToggleFollow}
                loading={followLoading}
                variant={isFollowing ? 'secondary' : 'primary'}
                size="sm"
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
              <Button
                onPress={async () => {
                  if (!sdk || !profile?.id) return;
                  try {
                    const res = await sdk.chat.dm({ user_id: profile.id });
                    if (res.data?.id) {
                      router.push({ pathname: '/(tabs)/chat', params: { id: res.data.id } } as any);
                    }
                  } catch {
                    if (Platform.OS === 'web') alert('Could not start chat');
                  }
                }}
                variant="secondary"
                size="sm"
              >
                Message
              </Button>
            </View>
          )}
        </View>

        <Divider marginVertical={spacing.xl} />

        {postsLoading ? (
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            {[1, 2].map(i => <Skeleton key={i} height={60} />)}
          </View>
        ) : userPosts.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
            <Text variant="body" color={colors.textMuted}>No posts yet</Text>
          </View>
        ) : (
          userPosts.map((post: any) => (
            <PostCard key={post.id} post={post} compact />
          ))
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </View>
  );
}
