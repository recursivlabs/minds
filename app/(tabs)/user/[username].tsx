import * as React from 'react';
import { View, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Button, Divider, PostCard, Skeleton, Card } from '../../../components';
import { TipModal } from '../../../components/TipModal';
import { useAuth } from '../../../lib/auth';
import { useProfile, usePosts } from '../../../lib/hooks';
import { ORG_ID } from '../../../lib/recursiv';
import { colors, spacing, radius } from '../../../constants/theme';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { profile, loading, error, isFollowing, setIsFollowing } = useProfile(username);
  const [followLoading, setFollowLoading] = React.useState(false);
  const [showTip, setShowTip] = React.useState(false);
  const [userPosts, setUserPosts] = React.useState<any[]>([]);
  const [postsLoading, setPostsLoading] = React.useState(true);

  const isOwnProfile = user?.id === profile?.id;

  // Fetch this user's posts directly
  React.useEffect(() => {
    if (!profile?.id || !sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.posts.list({
          limit: 50,
          organization_id: ORG_ID || undefined,
        });
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

  const handleTip = async (_amount: number, _message: string) => {
    const msg = 'Tipping coming soon — this feature will use MINDS tokens';
    if (Platform.OS === 'web') {
      alert(msg);
    } else {
      Alert.alert('Coming Soon', msg);
    }
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
          <Ionicons name="person-outline" size={32} color={colors.textMuted} />
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
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>@{username}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile info — left aligned */}
        <View style={{ paddingTop: spacing['2xl'], paddingHorizontal: spacing.xl }}>
          {/* Avatar + Name row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Avatar uri={profile.image || profile.avatar} name={profile.name} size="xl" />
            <View style={{ flex: 1 }}>
              <Text variant="h2">
                {profile.name || username}
              </Text>
              <Text variant="body" color={colors.textMuted} style={{ marginTop: 2 }}>
                @{profile.username || username}
              </Text>
            </View>
          </View>

          {profile.bio && (
            <Text
              variant="body"
              color={colors.textSecondary}
              style={{ marginTop: spacing.lg }}
            >
              {profile.bio}
            </Text>
          )}

          {/* Stats row */}
          <View style={{ flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followerCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Followers</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followingCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{userPosts.length}</Text>
              <Text variant="caption" color={colors.textMuted}>Posts</Text>
            </View>
          </View>

          {/* Actions */}
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
              <Button onPress={() => setShowTip(true)} variant="secondary" size="sm">
                Tip
              </Button>
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
            <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
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
