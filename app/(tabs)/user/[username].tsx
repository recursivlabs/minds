import * as React from 'react';
import { View, ScrollView, Pressable, Alert, Platform, Modal, TextInput, Image } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Button, PostCard, Skeleton } from '../../../components';
import { Container } from '../../../components/Container';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TabBar } from '../../../components/TabBar';
import { useAuth } from '../../../lib/auth';
import { useProfile, useMyProfile, useCommunities, useAgents } from '../../../lib/hooks';
import { ORG_ID } from '../../../lib/recursiv';
import { getBookmarks } from '../../../lib/bookmarks';
import { getCached } from '../../../lib/cache';
import { colors, spacing, radius, typography } from '../../../constants/theme';

const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;

const OWNER_TABS = ['posts', 'replies', 'blogs', 'followers', 'following', 'communities', 'agents', 'apps', 'saved'] as const;
const OTHER_TABS = ['posts', 'replies', 'blogs', 'followers', 'following', 'communities', 'agents'] as const;
type ProfileTab = typeof OWNER_TABS[number];

function SavedPostsTab() {
  const bookmarkIds = getBookmarks();
  const savedPosts = bookmarkIds.map(id => getCached(`post:${id}`)).filter(Boolean);
  if (savedPosts.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
        <Ionicons name="bookmark-outline" size={40} color={colors.accent} />
        <Text variant="h2" color={colors.text} align="center">Saved</Text>
        <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
          Posts you bookmark will appear here.
        </Text>
      </View>
    );
  }
  return (
    <View>
      {savedPosts.map((post: any) => (
        <PostCard key={post.id} post={post} compact />
      ))}
    </View>
  );
}

export default function UserProfileScreen() {
  const { username, tab: initialTab } = useLocalSearchParams<{ username: string; tab?: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user, signOut, refreshUser } = useAuth();
  const { profile, loading, error, isFollowing, setIsFollowing } = useProfile(username);
  const { refresh: refreshMyProfile } = useMyProfile();

  const isOwnProfile = !!user?.id && (user.id === profile?.id || user.username === username);
  const ALLOWED_TABS = isOwnProfile ? OWNER_TABS : OTHER_TABS;
  const validInitialTab: ProfileTab = (ALLOWED_TABS as readonly string[]).includes(initialTab || '')
    ? (initialTab as ProfileTab)
    : 'posts';
  const [profileTab, setProfileTab] = React.useState<ProfileTab>(validInitialTab);

  const [followLoading, setFollowLoading] = React.useState(false);
  const [userPosts, setUserPosts] = React.useState<any[]>([]);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [followersList, setFollowersList] = React.useState<any[] | null>(null);
  const [followingList, setFollowingList] = React.useState<any[] | null>(null);
  const [relationsLoading, setRelationsLoading] = React.useState(false);

  // Owner-only modals
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editUsername, setEditUsername] = React.useState('');
  const [editBio, setEditBio] = React.useState('');
  const [editSaving, setEditSaving] = React.useState(false);
  const [editAvatarUri, setEditAvatarUri] = React.useState<string | null>(null);

  const { communities } = useCommunities(isOwnProfile ? 50 : 0);
  const { agents } = useAgents(isOwnProfile ? 50 : 0);

  // Reset local state on username change
  React.useEffect(() => {
    setUserPosts([]);
    setPostsLoading(true);
    setFollowLoading(false);
    setFollowersList(null);
    setFollowingList(null);
  }, [username]);

  // Lazy-load followers / following
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

  // User's posts (for posts / replies / blogs tabs)
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
    setIsFollowing(!wasFollowing);
    setFollowerOffset(prev => wasFollowing ? prev - 1 : prev + 1);
    try {
      if (wasFollowing) await sdk.profiles.unfollow(profile.id);
      else await sdk.profiles.follow(profile.id);
    } catch (err: any) {
      setIsFollowing(wasFollowing);
      setFollowerOffset(prev => wasFollowing ? prev + 1 : prev - 1);
      const message = err?.message || `Could not ${wasFollowing ? 'unfollow' : 'follow'} — try again.`;
      if (Platform.OS === 'web') {
        (typeof window !== 'undefined' ? window : globalThis).alert?.(message);
      } else {
        Alert.alert('Follow failed', message);
      }
    } finally {
      setFollowLoading(false);
    }
  };

  const handlePickEditAvatar = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });
        if (!result.canceled && result.assets[0]) setEditAvatarUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setEditAvatarUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch {}
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
      <ScreenHeader title={`@${profile.username || username}`} />

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={{ paddingTop: spacing['3xl'], paddingHorizontal: spacing.xl }}>
          {/* Top row: avatar + owner action buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Avatar uri={profile.image || profile.avatar} name={profile.name} size="xl" />

            {isOwnProfile && (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button
                  onPress={() => {
                    setEditName(profile.name || '');
                    setEditUsername(profile.username || '');
                    setEditBio(profile.bio || '');
                    setEditAvatarUri(null);
                    setShowEditProfile(true);
                  }}
                  variant="secondary"
                  size="sm"
                  style={{ height: 36, minHeight: 36 }}
                >
                  Edit Profile
                </Button>
                <Pressable
                  onPress={() => setShowSettingsMenu(v => !v)}
                  style={{
                    width: 36, height: 36,
                    borderRadius: radius.sm,
                    backgroundColor: colors.glass,
                    borderWidth: 0.5, borderColor: colors.glassBorder,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="settings-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Settings dropdown */}
          {isOwnProfile && showSettingsMenu && (
            <View
              style={{
                position: 'absolute',
                right: spacing.xl,
                top: spacing['3xl'] + 44,
                backgroundColor: colors.surfaceRaised,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                padding: spacing.xs,
                zIndex: 9999,
                elevation: 999,
                minWidth: 160,
                ...(Platform.OS === 'web' ? { boxShadow: '0 4px 24px rgba(0,0,0,0.5)' } as any : {}),
              }}
            >
              <Pressable onPress={() => { setShowSettingsMenu(false); router.push('/(tabs)/settings'); }} style={{ padding: spacing.md }}>
                <Text variant="body">Settings</Text>
              </Pressable>
              <Pressable onPress={() => { setShowSettingsMenu(false); router.push('/(tabs)/billing'); }} style={{ padding: spacing.md }}>
                <Text variant="body">Billing</Text>
              </Pressable>
              <Pressable onPress={() => { setShowSettingsMenu(false); router.push('/(tabs)/invites'); }} style={{ padding: spacing.md }}>
                <Text variant="body">Invites</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setShowSettingsMenu(false);
                  await signOut();
                  router.replace('/');
                }}
                style={{ padding: spacing.md, borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}
              >
                <Text variant="body" color={colors.error}>Sign Out</Text>
              </Pressable>
            </View>
          )}

          {/* Name + badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
            <Text variant="h2">{profile.name || username}</Text>
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

          {/* Follower/Following counts */}
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

          {/* Non-owner action row */}
          {!isOwnProfile && (
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl, flexWrap: 'wrap' }}>
              <Button onPress={handleToggleFollow} loading={followLoading} variant={isFollowing ? 'secondary' : 'primary'} size="sm">
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
                  } catch { Alert.alert('Error', 'Could not start chat'); }
                }}
                variant="secondary"
                size="sm"
              >
                Message
              </Button>
              <Button
                onPress={async () => {
                  if (!profile?.id) return;
                  try {
                    const apiKey = await require('../../../lib/storage').getItem('minds:api_key');
                    await fetch(`${require('../../../lib/recursiv').BASE_ORIGIN}/api/v1/reports`, {
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

        {/* Tabs */}
        <View style={{ marginTop: spacing.xl }}>
          <TabBar
            tabs={ALLOWED_TABS.map(k => ({ key: k, label: k.charAt(0).toUpperCase() + k.slice(1) }))}
            active={profileTab}
            onChange={(k) => setProfileTab(k as ProfileTab)}
            scrollable
          />
        </View>

        {/* Posts */}
        {profileTab === 'posts' && (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : userPosts.filter((p: any) => !p.reply_to_id && !p.replyToId && !p.title).length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>No posts yet</Text>
            </View>
          ) : (
            userPosts.filter((p: any) => !p.reply_to_id && !p.replyToId && !p.title).map((post: any) => (
              <PostCard key={post.id} post={post} compact />
            ))
          )
        )}

        {/* Replies */}
        {profileTab === 'replies' && (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={60} />)}</View>
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

        {/* Blogs */}
        {profileTab === 'blogs' && (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : userPosts.filter((p: any) => p.title).length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>No blogs yet</Text>
            </View>
          ) : (
            userPosts.filter((p: any) => p.title).map((post: any) => (
              <PostCard key={post.id} post={post} compact />
            ))
          )
        )}

        {/* Followers */}
        {profileTab === 'followers' && (
          relationsLoading && followersList === null ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : !followersList || followersList.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>No followers yet</Text>
            </View>
          ) : (
            followersList.map((u: any) => <UserRow key={u.id} u={u} onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)} />)
          )
        )}

        {/* Following */}
        {profileTab === 'following' && (
          relationsLoading && followingList === null ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : !followingList || followingList.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>Not following anyone yet</Text>
            </View>
          ) : (
            followingList.map((u: any) => <UserRow key={u.id} u={u} onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)} />)
          )
        )}

        {/* Communities (owner only for now) */}
        {profileTab === 'communities' && (
          isOwnProfile ? (
            communities.filter((c: any) => c.is_member || c.isMember).length === 0 ? (
              <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
                <Text variant="body" color={colors.textMuted}>Not in any communities yet</Text>
              </View>
            ) : (
              <View style={{ padding: spacing.xl, gap: spacing.md }}>
                {communities.filter((c: any) => c.is_member || c.isMember).slice(0, 20).map((c: any) => (
                  <Pressable
                    key={c.id}
                    onPress={() => router.push(`/(tabs)/community/${c.slug || c.id}` as any)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
                      backgroundColor: colors.surface, borderRadius: radius.md,
                      borderWidth: 0.5, borderColor: colors.glassBorder,
                    }}
                  >
                    <Avatar uri={c.image || c.avatar} name={c.name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>{c.name}</Text>
                      {c.description && <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{c.description}</Text>}
                    </View>
                  </Pressable>
                ))}
              </View>
            )
          ) : (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>Communities this user has joined</Text>
            </View>
          )
        )}

        {/* Agents (owner only) */}
        {profileTab === 'agents' && (
          isOwnProfile ? (
            agents.length === 0 ? (
              <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
                <Text variant="body" color={colors.textMuted}>No agents yet</Text>
              </View>
            ) : (
              <View style={{ padding: spacing.xl, gap: spacing.md }}>
                {agents.slice(0, 20).map((a: any) => (
                  <Pressable
                    key={a.id}
                    onPress={() => router.push(`/(tabs)/user/${a.username || a.id}` as any)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
                      backgroundColor: colors.surface, borderRadius: radius.md,
                      borderWidth: 0.5, borderColor: colors.glassBorder,
                    }}
                  >
                    <Avatar uri={a.image || a.avatar} name={a.name} size="md" />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" numberOfLines={1}>{a.name}</Text>
                      {(a.bio || a.description) && <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{a.bio || a.description}</Text>}
                    </View>
                  </Pressable>
                ))}
              </View>
            )
          ) : (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>Agents created by this user</Text>
            </View>
          )
        )}

        {/* Apps (owner only) */}
        {profileTab === 'apps' && isOwnProfile && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
            <Ionicons name="cube-outline" size={40} color={colors.accent} />
            <Text variant="h2" color={colors.text} align="center">Apps</Text>
            <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>Build and deploy apps powered by the Minds network.</Text>
            <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create</Button>
          </View>
        )}

        {/* Saved (owner only) */}
        {profileTab === 'saved' && isOwnProfile && <SavedPostsTab />}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      {isOwnProfile && (
        <Modal visible={showEditProfile} transparent animationType="fade" onRequestClose={() => setShowEditProfile(false)}>
          <Pressable
            onPress={() => setShowEditProfile(false)}
            style={{
              flex: 1,
              backgroundColor: colors.overlay,
              justifyContent: 'center',
              alignItems: 'center',
              padding: spacing.xl,
            }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.bg,
                borderRadius: radius.xl,
                padding: spacing['2xl'],
                width: '100%',
                maxWidth: 400,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text variant="h3" style={{ marginBottom: spacing.xl }}>Edit Profile</Text>

              <Pressable onPress={handlePickEditAvatar} style={{ alignSelf: 'center', marginBottom: spacing.xl, position: 'relative' }}>
                {editAvatarUri ? (
                  <Image source={{ uri: editAvatarUri }} style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: colors.surfaceHover }} />
                ) : (
                  <Avatar uri={profile.image} name={profile.name} size="xl" />
                )}
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg }}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              </Pressable>

              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Name</Text>
              <TextInput value={editName} onChangeText={setEditName} placeholder="Your name" placeholderTextColor={colors.textMuted}
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, ...typography.body, marginBottom: spacing.lg, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />

              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Username</Text>
              <TextInput value={editUsername} onChangeText={(t) => setEditUsername(t.toLowerCase().replace(/[^a-z0-9_]/g, ''))} placeholder="username" placeholderTextColor={colors.textMuted} autoCapitalize="none"
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, ...typography.body, marginBottom: spacing.lg, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />

              <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Bio</Text>
              <TextInput value={editBio} onChangeText={setEditBio} placeholder="Tell people about yourself" placeholderTextColor={colors.textMuted} multiline numberOfLines={3}
                style={{ backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, minHeight: 80, textAlignVertical: 'top', ...typography.body, marginBottom: spacing.xl, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
              />

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button onPress={() => setShowEditProfile(false)} variant="secondary" fullWidth>Cancel</Button>
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    loading={editSaving}
                    onPress={async () => {
                      if (!sdk) return;
                      setEditSaving(true);
                      try {
                        if (editAvatarUri) {
                          try {
                            const blobRes = await fetch(editAvatarUri);
                            const blob = await blobRes.blob();
                            const contentType = blob.type || 'image/jpeg';
                            const uploads = sdk.uploads;
                            const uploadRes = await uploads.getAvatarUploadUrl({ content_type: contentType, content_length: blob.size });
                            const uploadUrl = (uploadRes.data as any)?.upload_url || (uploadRes.data as any)?.url;
                            const key = uploadRes.data?.key;
                            if (uploadUrl) {
                              const putRes = await fetch(uploadUrl, { method: 'PUT', body: blob, headers: { 'Content-Type': contentType } });
                              if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status} ${putRes.statusText}`);
                              if (key) await uploads.confirmAvatarUpload(key);
                            } else {
                              throw new Error('No upload URL returned from server');
                            }
                          } catch (err: any) {
                            Alert.alert('Avatar Error', err?.message || String(err) || 'Upload failed.');
                          }
                        }
                        const newUsername = editUsername.trim();
                        await sdk.profiles.update({
                          name: editName.trim(),
                          username: newUsername || undefined,
                          bio: editBio.trim(),
                        });
                        await refreshMyProfile();
                        await refreshUser();
                        setShowEditProfile(false);
                        // If the username changed, navigate to the new canonical URL
                        if (newUsername && newUsername !== username) {
                          router.replace(`/(tabs)/user/${newUsername}` as any);
                        }
                      } catch {
                        Alert.alert('Error', 'Failed to update profile.');
                      } finally {
                        setEditSaving(false);
                      }
                    }}
                    fullWidth
                  >
                    Save
                  </Button>
                </View>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Container>
  );
}

function UserRow({ u, onPress }: { u: any; onPress: () => void }) {
  const displayName = u.name || u.username || 'Unnamed user';
  const handle = u.username ? `@${u.username}` : '';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={u.image} name={displayName} size="sm" />
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>{displayName}</Text>
        {u.bio ? (
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{u.bio}</Text>
        ) : handle ? (
          <Text variant="caption" color={colors.textMuted}>{handle}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}
