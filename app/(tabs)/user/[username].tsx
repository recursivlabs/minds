import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Button, Divider, PostCard, Skeleton, Card } from '../../../components';
import { TipModal } from '../../../components/TipModal';
import { useAuth } from '../../../lib/auth';
import { useProfile, usePosts } from '../../../lib/hooks';
import { colors, spacing, radius } from '../../../constants/theme';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { profile, loading, error, isFollowing, setIsFollowing } = useProfile(username);
  const { posts } = usePosts('latest', 50);
  const [followLoading, setFollowLoading] = React.useState(false);
  const [showTip, setShowTip] = React.useState(false);

  const isOwnProfile = user?.id === profile?.id;
  const userPosts = posts.filter(
    (p: any) => {
      const authorId = p.author?.id || p.userId || p.user_id;
      const authorUsername = p.author?.username;
      return authorId === profile?.id || authorUsername === username;
    }
  );

  const followerCount = profile?.followerCount || profile?.follower_count || 0;
  const followingCount = profile?.followingCount || profile?.following_count || 0;

  const handleToggleFollow = async () => {
    if (!sdk || !profile?.id) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);

    try {
      if (wasFollowing) {
        await sdk.profiles.unfollow(profile.id);
      } else {
        await sdk.profiles.follow(profile.id);
      }
    } catch {
      setIsFollowing(wasFollowing);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleTip = async (amount: number, message: string) => {
    console.log('Tip:', { userId: profile?.id, amount, message });
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        </View>
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
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
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3">User</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="person-outline" size={48} color={colors.textMuted} />
          <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
            {error || 'User not found'}
          </Text>
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
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>@{username}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile info */}
        <View style={{ alignItems: 'center', paddingTop: spacing['3xl'], paddingHorizontal: spacing.xl }}>
          <Avatar uri={profile.image || profile.avatar} name={profile.name} size="xl" />
          <Text variant="h2" style={{ marginTop: spacing.lg }}>
            {profile.name || username}
          </Text>
          <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            @{profile.username || username}
          </Text>

          {profile.bio && (
            <Text
              variant="body"
              color={colors.textSecondary}
              align="center"
              style={{ marginTop: spacing.md, maxWidth: 300 }}
            >
              {profile.bio}
            </Text>
          )}

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: spacing['3xl'], marginTop: spacing.xl }}>
            <View style={{ alignItems: 'center' }}>
              <Text variant="h3">{userPosts.length}</Text>
              <Text variant="caption" color={colors.textMuted}>Posts</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text variant="h3">{followerCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Followers</Text>
            </View>
            <View style={{ alignItems: 'center' }}>
              <Text variant="h3">{followingCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </View>
          </View>

          {/* Actions */}
          {!isOwnProfile && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, width: '100%' }}>
              <View style={{ flex: 1 }}>
                <Button
                  onPress={handleToggleFollow}
                  loading={followLoading}
                  variant={isFollowing ? 'secondary' : 'primary'}
                  fullWidth
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button onPress={() => setShowTip(true)} variant="secondary" fullWidth>
                  Tip
                </Button>
              </View>
            </View>
          )}
        </View>

        <Divider marginVertical={spacing.xl} />

        {/* Posts */}
        <View style={{ paddingHorizontal: spacing.xl, marginBottom: spacing.sm }}>
          <Text variant="h3">Posts</Text>
        </View>

        {userPosts.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
            <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted} align="center">
              This user hasn't posted yet
            </Text>
          </View>
        ) : (
          userPosts.map((post: any) => (
            <PostCard key={post.id} post={post} compact />
          ))
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      <TipModal
        visible={showTip}
        onClose={() => setShowTip(false)}
        recipientName={profile.name || username}
        recipientAvatar={profile.image}
        onSend={handleTip}
      />
    </View>
  );
}
