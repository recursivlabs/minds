import * as React from 'react';
import { View, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Button, Divider, PostCard, Skeleton } from '../../../components';
import { Container } from '../../../components/Container';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TabBar } from '../../../components/TabBar';
import { useAuth } from '../../../lib/auth';
import { useProfile } from '../../../lib/hooks';
import { ORG_ID } from '../../../lib/recursiv';
import { colors, spacing } from '../../../constants/theme';

export default function UserProfileScreen() {
  const { username, tab: initialTab } = useLocalSearchParams<{ username: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { profile, loading, error, isFollowing, setIsFollowing } = useProfile(username);
  const [followLoading, setFollowLoading] = React.useState(false);
  const [userPosts, setUserPosts] = React.useState<any[]>([]);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const ALLOWED_TABS = ['posts', 'replies', 'communities', 'agents', 'followers', 'following'] as const;
  type ProfileTab = typeof ALLOWED_TABS[number];
  const validInitialTab: ProfileTab = (ALLOWED_TABS as readonly string[]).includes(initialTab || '') ? (initialTab as ProfileTab) : 'posts';
  const [profileTab, setProfileTab] = React.useState<ProfileTab>(validInitialTab);
  const [followersList, setFollowersList] = React.useState<any[] | null>(null);
  const [followingList, setFollowingList] = React.useState<any[] | null>(null);
  const [relationsLoading, setRelationsLoading] = React.useState(false);

  const isOwnProfile = user?.id === profile?.id;

  // Reset local state when username changes (prevents flash of old profile's posts)
  React.useEffect(() => {
    setUserPosts([]);
    setPostsLoading(true);
    setFollowLoading(false);
    setFollowersList(null);
    setFollowingList(null);
  }, [username]);

  // Lazy-load followers / following when the user opens those tabs.
  React.useEffect(() => {
    if (!profile?.id || !sdk) return;
    if (profileTab !== 'followers' && profileTab !== 'following') return;

    const needsLoad =
      (profileTab === 'followers' && followersList === null) ||
      (profileTab === 'following' && followingList === null);
    if (!needsLoad) return;

    let cancelled = false;
    setRelationsLoading(true);
    (async () => {
      try {
        const res = profileTab === 'followers'
          ? await sdk.profiles.followers(profile.id, { limit: 100 })
          : await sdk.profiles.following(profile.id, { limit: 100 });
        const list = (res.data || []) as any[];
        if (cancelled) return;
        if (profileTab === 'followers') setFollowersList(list);
        else setFollowingList(list);
      } catch {
        if (!cancelled) {
          if (profileTab === 'followers') setFollowersList([]);
          else setFollowingList([]);
        }
      } finally {
        if (!cancelled) setRelationsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profileTab, profile?.id, sdk, followersList, followingList]);

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

  const baseFollowerCount = profile?.followerCount || profile?.follower_count || 0;
  const followingCount = profile?.followingCount || profile?.following_count || 0;
  const [followerOffset, setFollowerOffset] = React.useState(0);
  const followerCount = baseFollowerCount + followerOffset;

  const handleToggleFollow = async () => {
    if (!sdk || !profile?.id) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    // Optimistic update — flip immediately so the button shows the new state.
    setIsFollowing(!wasFollowing);
    setFollowerOffset(prev => wasFollowing ? prev - 1 : prev + 1);
    try {
      if (wasFollowing) await sdk.profiles.unfollow(profile.id);
      else await sdk.profiles.follow(profile.id);
    } catch (err: any) {
      // Surface the error instead of silently reverting — users couldn't tell
      // whether the click registered otherwise.
      console.error('toggle_follow_failed', err);
      setIsFollowing(wasFollowing);
      setFollowerOffset(prev => wasFollowing ? prev + 1 : prev - 1);
      const message = err?.message || `Could not ${wasFollowing ? 'unfollow' : 'follow'} — try again.`;
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        (typeof window !== 'undefined' ? window : globalThis).alert?.(message);
      } else {
        Alert.alert('Follow failed', message);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  if (loading) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="" />
        <View style={{ padding: spacing['3xl'], gap: spacing.lg }}>
          <Skeleton width={80} height={80} borderRadius={40} />
          <Skeleton width={160} height={20} />
          <Skeleton width={120} height={14} />
        </View>
      </Container>
    );
  }

  if (error || !profile) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="User" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={colors.textMuted}>{error || 'User not found'}</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title={`@${username}`} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: spacing['3xl'], paddingHorizontal: spacing.xl }}>
          <Avatar uri={profile.image || profile.avatar} name={profile.name} size="xl" />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
            <Text variant="h2">
              {profile.name || username}
            </Text>
            {(profile.isAi || profile.is_ai) && (
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
              </View>
            )}
            {profile.role === 'admin' && (
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>Admin</Text>
              </View>
            )}
          </View>
          <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            @{profile.username || username}
          </Text>
          {(profile.createdAt || profile.created_at) && (
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
              Joined {new Date(profile.createdAt || profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
          )}

          {profile.bio && (
            <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.md, lineHeight: 22 }}>
              {profile.bio}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.xl }}>
            <Pressable onPress={() => setProfileTab('following')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followingCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </Pressable>
            <Pressable onPress={() => setProfileTab('followers')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followerCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Followers</Text>
            </Pressable>
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
                    Alert.alert('Error', 'Could not start chat');
                  }
                }}
                variant="secondary"
                size="sm"
              >
                Message
              </Button>
              <Button
                onPress={() => {
                  Alert.prompt ? Alert.prompt(
                    'Tip',
                    `Send a tip to ${profile.name || username}`,
                    async (amount: string) => {
                      if (!amount || !sdk || !profile?.walletAddress) return;
                      try {
                        await sdk.wallet.send(profile.walletAddress, amount);
                        Alert.alert('Success', `Tipped ${amount} ETH`);
                      } catch { Alert.alert('Error', 'Tip failed'); }
                    },
                    'plain-text',
                    '',
                    'decimal-pad'
                  ) : Alert.alert('Tip', 'Tipping will be available when the token system launches.');
                }}
                variant="ghost"
                size="sm"
              >
                Tip
              </Button>
              <Button
                onPress={async () => {
                  if (!profile?.id) return;
                  try {
                    const apiKey = await require('../../lib/storage').getItem('minds:api_key');
                    await fetch(`${require('../../lib/recursiv').BASE_ORIGIN}/api/v1/reports`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
                      body: JSON.stringify({ target_type: 'user', target_id: profile.id, reason: 'Reported from profile', details: '' }),
                    });
                  } catch {}
                  Alert.alert('Report', 'User has been reported. Thank you.');
                }}
                variant="ghost"
                size="sm"
              >
                Report
              </Button>
            </View>
          )}
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <TabBar
            tabs={[
              { key: 'posts', label: 'Posts' },
              { key: 'replies', label: 'Replies' },
              { key: 'followers', label: 'Followers' },
              { key: 'following', label: 'Following' },
              { key: 'communities', label: 'Communities' },
              { key: 'agents', label: 'Agents' },
            ]}
            active={profileTab}
            onChange={(k) => setProfileTab(k as any)}
          />
        </View>

        {profileTab === 'posts' && (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {[1, 2].map(i => <Skeleton key={i} height={60} />)}
            </View>
          ) : userPosts.filter((p: any) => !p.reply_to_id && !p.replyToId).length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>No posts yet</Text>
            </View>
          ) : (
            userPosts.filter((p: any) => !p.reply_to_id && !p.replyToId).map((post: any) => (
              <PostCard key={post.id} post={post} compact />
            ))
          )
        )}

        {profileTab === 'replies' && (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {[1, 2].map(i => <Skeleton key={i} height={60} />)}
            </View>
          ) : userPosts.filter((p: any) => p.reply_to_id || p.replyToId).length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>No replies yet</Text>
            </View>
          ) : (
            userPosts.filter((p: any) => p.reply_to_id || p.replyToId).map((post: any) => (
              <PostCard key={post.id} post={post} compact />
            ))
          )
        )}

        {profileTab === 'followers' && (
          relationsLoading && followersList === null ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}
            </View>
          ) : !followersList || followersList.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>No followers yet</Text>
            </View>
          ) : (
            followersList.map((u: any) => (
              <Pressable
                key={u.id}
                onPress={() => router.push(`/(tabs)/user/${u.username}` as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                })}
              >
                <Avatar uri={u.image} name={u.name} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>{u.name || u.username}</Text>
                  {u.bio ? (
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{u.bio}</Text>
                  ) : (
                    <Text variant="caption" color={colors.textMuted}>@{u.username}</Text>
                  )}
                </View>
              </Pressable>
            ))
          )
        )}

        {profileTab === 'following' && (
          relationsLoading && followingList === null ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}
            </View>
          ) : !followingList || followingList.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>Not following anyone yet</Text>
            </View>
          ) : (
            followingList.map((u: any) => (
              <Pressable
                key={u.id}
                onPress={() => router.push(`/(tabs)/user/${u.username}` as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                })}
              >
                <Avatar uri={u.image} name={u.name} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>{u.name || u.username}</Text>
                  {u.bio ? (
                    <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{u.bio}</Text>
                  ) : (
                    <Text variant="caption" color={colors.textMuted}>@{u.username}</Text>
                  )}
                </View>
              </Pressable>
            ))
          )
        )}

        {profileTab === 'communities' && (
          <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
            <Text variant="body" color={colors.textMuted}>Communities this user has joined</Text>
          </View>
        )}

        {profileTab === 'agents' && (
          <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
            <Text variant="body" color={colors.textMuted}>Agents created by this user</Text>
          </View>
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </Container>
  );
}
