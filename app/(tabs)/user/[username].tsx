import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Modal, TextInput, Image } from 'react-native';
import { showToast } from '../../../components/Toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator } from 'react-native';
import { Text, Avatar, Button, PostCard, Skeleton, RightRailLayout, AgentBadge } from '../../../components';
import { ImageCropper, CROP_AVATAR } from '../../../components/ImageCropper';
import { Container } from '../../../components/Container';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { TabBar } from '../../../components/TabBar';
import { useAuth } from '../../../lib/auth';
import { useProfile, useMyProfile, useCommunities, useProfilePosts } from '../../../lib/hooks';
import { ORG_ID } from '../../../lib/recursiv';
import { getFollowRelationship } from '../../../lib/moderation';
import { getBookmarks } from '../../../lib/bookmarks';
import { getCached, invalidate, fetchDeduped } from '../../../lib/cache';
import { spacing, radius, typography } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { profileFollowerCount, profileFollowingCount, isArticlePost } from '../../../lib/models';
import { formatCount } from '../../../lib/discover';

const getImagePicker = () => Platform.OS !== 'web' ? require('expo-image-picker') : null;

// Owner gets a Saved tab (private bookmarks). Visitors don't. Both
// share the same primary tab order so the IA reads the same way.
const OWNER_TABS = ['posts', 'articles', 'replies', 'communities', 'saved', 'followers', 'following'] as const;
const OTHER_TABS = ['posts', 'articles', 'replies', 'communities', 'followers', 'following'] as const;
type ProfileTab = typeof OWNER_TABS[number];

function SavedPostsTab({ query = '' }: { query?: string }) {
  const colors = useColors();
  const bookmarkIds = getBookmarks();
  const q = query.trim().toLowerCase();
  const allSaved = bookmarkIds.map(id => getCached(`post:${id}`)).filter(Boolean) as any[];
  const savedPosts = q
    ? allSaved.filter((p: any) => typeof p?.content === 'string' && p.content.toLowerCase().includes(q))
    : allSaved;
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
  const colors = useColors();
  const { profile, loading, error, isFollowing, setIsFollowing, refresh: refreshProfile } = useProfile(username);
  const { refresh: refreshMyProfile } = useMyProfile();

  const isOwnProfile = !!user?.id && (user.id === profile?.id || user.username === username);

  // Check if this is the viewer's OWN AI agent. We fetch the user's
  // agents list (which includes personal agents) and check membership.
  const [isMyAgent, setIsMyAgent] = React.useState(false);
  React.useEffect(() => {
    if (!sdk || !profile?.id || !(profile.isAi || profile.is_ai)) {
      setIsMyAgent(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Dedupe the heavy owned-agents scan so two profile views (or a view
        // racing the chat/sidebar personal-agent lookup) don't each fire a
        // separate /agents?limit=100 — part of the request-storm cleanup.
        const res = await fetchDeduped('req:owned-agents:100', () => sdk.agents.list({ limit: 100 }));
        if (cancelled) return;
        const owned = (res.data || []).some((a: any) => a.id === profile.id);
        setIsMyAgent(owned);
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [sdk, profile?.id, profile?.isAi, profile?.is_ai]);
  // The official @minds channel is followed by ~every user, so its follower
  // count effectively discloses the total network size, and its followers list
  // is a prime scrape/spam target. Hide both (count + tab) for all viewers.
  const isMindsChannel = (profile?.username || username || '').toLowerCase() === 'minds';
  const ALLOWED_TABS = (isOwnProfile ? OWNER_TABS : OTHER_TABS)
    .filter((t) => !(isMindsChannel && t === 'followers')) as readonly ProfileTab[];
  const validInitialTab: ProfileTab = (ALLOWED_TABS as readonly string[]).includes(initialTab || '')
    ? (initialTab as ProfileTab)
    : 'posts';
  const [profileTab, setProfileTab] = React.useState<ProfileTab>(validInitialTab);

  // Per-tab search (own profile only). One input that adapts to the active tab
  // and filters that tab's list client-side — there's no server search for a
  // user's own posts/replies/communities/saved/followers/following, so each is
  // filtered over the already-loaded list. Resets when the active tab changes.
  const [tabSearch, setTabSearch] = React.useState('');
  React.useEffect(() => { setTabSearch(''); }, [profileTab]);
  const searchQ = tabSearch.trim().toLowerCase();
  const isTabSearching = searchQ.length > 0;
  const matchText = React.useCallback((...vals: any[]) =>
    !searchQ || vals.some((v) => typeof v === 'string' && v.toLowerCase().includes(searchQ)),
    [searchQ]);
  const searchPlaceholder =
    profileTab === 'posts' ? 'Search your posts…'
    : profileTab === 'articles' ? 'Search your articles…'
    : profileTab === 'replies' ? 'Search your replies…'
    : profileTab === 'communities' ? 'Search communities…'
    : profileTab === 'saved' ? 'Search saved…'
    : profileTab === 'followers' ? 'Search followers…'
    : 'Search following…';

  const [followLoading, setFollowLoading] = React.useState(false);
  const [followsYou, setFollowsYou] = React.useState(false);
  // Paginated author feeds (posts + replies). These infinite-scroll through ALL
  // the user's posts via author_id + offset + has_more, mirroring useDiscoverPosts —
  // replacing the old one-shot `posts.list({ author_id, limit: 50 })` that capped a
  // profile at a single page no matter how many posts the user had.
  const {
    posts: userPosts,
    loading: postsLoading,
    hasMore: postsHasMore,
    loadMore: loadMorePosts,
  } = useProfilePosts(profile?.id, { limit: 30 });
  const {
    posts: userReplies,
    loading: repliesLoading,
    hasMore: repliesHasMore,
    loadMore: loadMoreReplies,
  } = useProfilePosts(profile?.id, { replies: true, limit: 30 });
  const [followersList, setFollowersList] = React.useState<any[] | null>(null);
  const [followingList, setFollowingList] = React.useState<any[] | null>(null);
  const [relationsLoading, setRelationsLoading] = React.useState(false);

  // Owner-only modals
  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editUsername, setEditUsername] = React.useState('');
  const [editBio, setEditBio] = React.useState('');
  const [bioExpanded, setBioExpanded] = React.useState(false);
  const [editSaving, setEditSaving] = React.useState(false);
  const [editAvatarUri, setEditAvatarUri] = React.useState<string | null>(null);
  // Uri handed to the ImageCropper; its onDone sets editAvatarUri to the crop.
  const [cropUri, setCropUri] = React.useState<string | null>(null);

  const { communities } = useCommunities(isOwnProfile ? 50 : 0);

  // Reset local state on username change. (Post/reply feeds reset themselves
  // inside useProfilePosts when profile.id changes.)
  React.useEffect(() => {
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

  // Does this user follow you back? (for the "Follows you" badge)
  React.useEffect(() => {
    if (!profile?.id || isOwnProfile) { setFollowsYou(false); return; }
    let alive = true;
    getFollowRelationship(profile.id).then((r) => { if (alive) setFollowsYou(r.follows_you); });
    return () => { alive = false; };
  }, [profile?.id, isOwnProfile]);

  // Counts via the centralized, unit-tested accessors (handles the
  // followers_count vs follower_count drift that caused a real bug).
  const baseFollowerCount = profileFollowerCount(profile);
  const followingCount = profileFollowingCount(profile);
  const [followerOffset, setFollowerOffset] = React.useState(0);
  const followerCount = baseFollowerCount + followerOffset;

  // Infinite scroll for the Posts / Replies tabs. The profile lives inside a
  // single ScrollView (header + tabs + feed), so we detect "near bottom" on
  // scroll and page the active tab's author feed via its loadMore — same effect
  // as a FlatList's onEndReached, without restructuring the whole screen.
  // NOTE: this hook MUST stay above the early returns below (loading / error)
  // so the hook count is identical on every render — otherwise React throws
  // #310 ("rendered more hooks than during the previous render").
  const handleScroll = React.useCallback((e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceFromBottom > 600) return;
    if (profileTab === 'posts' || profileTab === 'articles') loadMorePosts();
    else if (profileTab === 'replies') loadMoreReplies();
  }, [profileTab, loadMorePosts, loadMoreReplies]);

  const handleToggleFollow = async () => {
    if (!sdk || !profile?.id) return;
    setFollowLoading(true);
    const wasFollowing = isFollowing;
    setIsFollowing(!wasFollowing);
    setFollowerOffset(prev => wasFollowing ? prev - 1 : prev + 1);
    try {
      if (wasFollowing) await sdk.profiles.unfollow(profile.id);
      else await sdk.profiles.follow(profile.id);
      // Server is the source of truth for counts (computed from the
      // follow table on read, no denorm). Pull a fresh profile so the
      // header reflects reality the moment the optimistic offset goes
      // away. Reset the offset once the new count lands so we don't
      // double-count.
      await refreshProfile();
      setFollowerOffset(0);
      // Followers/Following lists drawn lazily — drop any cached
      // copy so the next tap re-pulls.
      setFollowersList(null);
      setFollowingList(null);
      // Reconcile the CURRENT user's own counts too: following someone bumps
      // your "following" count, which is shown on your own profile (a different
      // cache). Invalidate it so it's fresh the next time you view your profile
      // instead of showing a stale number until the cache expires.
      invalidate('myprofile');
      if (user?.username) invalidate(`profile:${user.username}`);
      if (user?.id) invalidate(`profile:${user.id}`);
    } catch (err: any) {
      setIsFollowing(wasFollowing);
      setFollowerOffset(prev => wasFollowing ? prev + 1 : prev - 1);
      const message = err?.message || `Could not ${wasFollowing ? 'unfollow' : 'follow'} — try again.`;
      if (Platform.OS === 'web') {
        (typeof window !== 'undefined' ? window : globalThis).alert?.(message);
      } else {
        showToast(message, 'error');
      }
    } finally {
      setFollowLoading(false);
    }
  };

  // Pick the FULL image (no OS crop) and route it through our own ImageCropper —
  // the OS `allowsEditing` crop was inconsistent across iOS/Android and absent on
  // web. Our cropper guarantees a spec-perfect result on every platform.
  const handlePickEditAvatar = async () => {
    try {
      const picker = getImagePicker();
      if (picker) {
        const result = await picker.launchImageLibraryAsync({
          mediaTypes: picker.MediaTypeOptions.Images,
          quality: 1,
        });
        if (!result.canceled && result.assets[0]) setCropUri(result.assets[0].uri);
      } else if (Platform.OS === 'web') {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: any) => {
          const file = e.target?.files?.[0];
          if (file) setCropUri(URL.createObjectURL(file));
        };
        input.click();
      }
    } catch {}
  };

  // Show the skeleton while loading AND during the brief post-fetch window where
  // profile hasn't committed yet (no error). Without the `!profile && !error`
  // guard, that transient flashed the "User not found" state before the profile
  // rendered. Not-found only shows once an error is actually set.
  if (loading || (!profile && !error)) {
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

      <RightRailLayout context="profile">
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} onScroll={handleScroll} scrollEventThrottle={16}>
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
                  style={{
                    height: 36,
                    minHeight: 36,
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    borderWidth: 0.5,
                  }}
                >
                  Edit Profile
                </Button>
                <Pressable
                  onPress={() => setShowSettingsMenu(v => !v)}
                  style={{
                    width: 36, height: 36,
                    borderRadius: radius.sm,
                    backgroundColor: colors.surface,
                    borderWidth: 0.5, borderColor: colors.border,
                    alignItems: 'center', justifyContent: 'center',
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="settings-outline" size={20} color={colors.text} />
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

          {/* Edit Agent CTA — only for the actual personal agent.
             `isMyAgent` is true for any owned agent (incl. user-created),
             but the `/agent` editor hardcodes the personal agent. Showing
             this CTA on user-created agent profiles + routing to `/agent`
             would silently send the user to their personal agent's editor. */}
          {isMyAgent && (((profile as any)?.agent_type === 'personal') || ((profile as any)?.agentType === 'personal')) && (
            <View style={{ marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.border }}>
              <Text variant="bodyMedium" color={colors.text} style={{ marginBottom: spacing.xs }}>Your personal agent</Text>
              <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18, marginBottom: spacing.md }}>
                Edit your agent's name, voice, and full system prompt. You control how it works.
              </Text>
              <Pressable
                onPress={() => router.push('/agent' as any)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.sm,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.sm,
                  backgroundColor: pressed ? colors.surfaceHover : colors.bg,
                  borderWidth: 0.5,
                  borderColor: colors.border,
                })}
              >
                <Text variant="body" color={colors.text}>Edit agent</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          )}

          {/* Name + badges */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg }}>
            <Text variant="h2">{profile.name || username}</Text>
            {(profile.isAi || profile.is_ai) && <AgentBadge size={15} />}
            {profile.role === 'admin' && (
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>Admin</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs }}>
            <Text variant="body" color={colors.textMuted}>
              @{profile.username || username}
            </Text>
            {followsYou && (
              <View style={{ backgroundColor: colors.surfaceRaised, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 4 }}>
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>Follows you</Text>
              </View>
            )}
          </View>
          {(profile.createdAt || profile.created_at) && (
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
              Joined {new Date(profile.createdAt || profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            </Text>
          )}

          {profile.bio && (
            <View style={{ marginTop: spacing.md }}>
              <Text variant="body" color={colors.textSecondary} numberOfLines={bioExpanded ? undefined : 4} style={{ lineHeight: 22 }}>
                {profile.bio}
              </Text>
              {/* Long bios truncate with a toggle so the profile header stays tidy. */}
              {String(profile.bio).length > 160 ? (
                <Pressable onPress={() => setBioExpanded(v => !v)} hitSlop={6} style={{ marginTop: 2 }}>
                  <Text variant="caption" color={colors.accent}>{bioExpanded ? 'Show less' : 'Show more'}</Text>
                </Pressable>
              ) : null}
            </View>
          )}

          {/* Follower/Following counts */}
          <View style={{ flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.xl }}>
            <Pressable onPress={() => setProfileTab('following')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{formatCount(followingCount)}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </Pressable>
            {!isMindsChannel && (
              <Pressable onPress={() => setProfileTab('followers')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text variant="bodyMedium">{formatCount(followerCount)}</Text>
                <Text variant="caption" color={colors.textMuted}>Followers</Text>
              </Pressable>
            )}
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
                    const res = await sdk.chat.dm({ user_id: profile.id, organization_id: ORG_ID || undefined } as any);
                    if (res.data?.id) {
                      router.push({ pathname: '/(tabs)/chat', params: { id: res.data.id } } as any);
                    }
                  } catch { showToast('Could not start chat', 'error'); }
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
                  showToast('User has been reported. Thank you.', 'success');
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

        {/* Per-tab search — own profile only. One input that filters the active
            tab's list (posts/replies by text, communities by name, saved by text,
            followers/following by name/handle). Matches the app's search styling. */}
        {isOwnProfile && (
          <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md }}>
            <View
              style={{
                flexDirection: 'row', alignItems: 'center',
                backgroundColor: colors.surface, borderRadius: radius.full,
                borderWidth: 0.5, borderColor: colors.glassBorder,
                paddingHorizontal: spacing.md, gap: spacing.sm,
              }}
            >
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                placeholder={searchPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={tabSearch}
                onChangeText={setTabSearch}
                autoCapitalize="none"
                style={{
                  flex: 1, color: colors.text, ...typography.body, paddingVertical: 9,
                  ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
                }}
              />
              {tabSearch.length > 0 && (
                <Pressable onPress={() => setTabSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* Posts */}
        {profileTab === 'posts' && (() => {
          const visiblePosts = userPosts
            .filter((p: any) => !p.reply_to_id && !p.replyToId && !p.title)
            .filter((p: any) => matchText(p.content, p.title));
          return (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : visiblePosts.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching posts' : 'No posts yet'}</Text>
            </View>
          ) : (
            <>
              {visiblePosts.map((post: any) => (
                <PostCard key={post.id} post={post} compact />
              ))}
              {!isTabSearching && postsHasMore && (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </>
          )
          );
        })()}

        {/* Articles — long-form posts (title + markdown). PostCard renders them
            as the article card; the 'posts' tab already excludes titled posts. */}
        {profileTab === 'articles' && (() => {
          const visibleArticles = userPosts
            .filter((p: any) => isArticlePost(p))
            .filter((p: any) => matchText(p.content, p.title));
          return (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={80} />)}</View>
          ) : visibleArticles.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching articles' : 'No articles yet'}</Text>
            </View>
          ) : (
            <>
              {visibleArticles.map((post: any) => (
                <PostCard key={post.id} post={post} compact />
              ))}
              {!isTabSearching && postsHasMore && (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </>
          )
          );
        })()}

        {/* Replies — X-style: each reply shows "Replying to @x" (clickable to the
            parent) above the reply card. */}
        {profileTab === 'replies' && (() => {
          const visibleReplies = userReplies.filter((p: any) => matchText(p.content, p.reply_to?.content, p.reply_to?.author?.username));
          return (
          repliesLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : visibleReplies.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching replies' : 'No replies yet'}</Text>
            </View>
          ) : (
            <>
              {visibleReplies.map((post: any) => {
                const parent = post.reply_to;
                const parentHandle = parent?.author?.username;
                return (
                  <View key={post.id}>
                    {parentHandle ? (
                      <Pressable
                        onPress={() => { if (parent?.id) router.push(`/post/${parent.id}` as any); }}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.md }}
                      >
                        <Ionicons name="arrow-undo-outline" size={13} color={colors.textMuted} />
                        <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>
                          Replying to <Text variant="caption" color={colors.accent}>@{parentHandle}</Text>
                          {parent?.content ? `  ${parent.content.slice(0, 50)}` : ''}
                        </Text>
                      </Pressable>
                    ) : null}
                    <PostCard post={post} compact />
                  </View>
                );
              })}
              {repliesHasMore && (
                <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                  <ActivityIndicator color={colors.accent} />
                </View>
              )}
            </>
          )
          );
        })()}

        {/* Articles */}
        {/* Followers */}
        {profileTab === 'followers' && (() => {
          const visible = (followersList || []).filter((u: any) => matchText(u.name, u.username, u.bio));
          return (
          relationsLoading && followersList === null ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : !followersList || visible.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching followers' : 'No followers yet'}</Text>
            </View>
          ) : (
            visible.map((u: any) => <UserRow key={u.id} u={u} onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)} />)
          )
          );
        })()}

        {/* Following */}
        {profileTab === 'following' && (() => {
          const visible = (followingList || []).filter((u: any) => matchText(u.name, u.username, u.bio));
          return (
          relationsLoading && followingList === null ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>{[1, 2, 3].map(i => <Skeleton key={i} height={60} />)}</View>
          ) : !followingList || visible.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching accounts' : 'Not following anyone yet'}</Text>
            </View>
          ) : (
            visible.map((u: any) => <UserRow key={u.id} u={u} onPress={() => router.push(`/(tabs)/user/${u.username || u.id}` as any)} />)
          )
          );
        })()}

        {/* Communities (owner only for now) */}
        {profileTab === 'communities' && (() => {
          const myComms = communities
            .filter((c: any) => c.is_member || c.isMember)
            .filter((c: any) => matchText(c.name, c.description));
          return (
          isOwnProfile ? (
            myComms.length === 0 ? (
              <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
                <Text variant="body" color={colors.textMuted}>{isTabSearching ? 'No matching communities' : 'Not in any communities yet'}</Text>
              </View>
            ) : (
              <View style={{ padding: spacing.xl, gap: spacing.md }}>
                {myComms.slice(0, 20).map((c: any) => (
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
          );
        })()}

        {/* Saved (owner only) */}
        {profileTab === 'saved' && isOwnProfile && <SavedPostsTab query={tabSearch} />}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
      </RightRailLayout>

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
                            showToast(err?.message || String(err) || 'Upload failed.', 'error');
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
                        showToast('Failed to update profile.', 'error');
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

      {/* Full-screen crop step: picking an avatar hands the raw image here; the
          cropped result becomes editAvatarUri for the existing upload flow. */}
      <ImageCropper
        uri={cropUri}
        spec={CROP_AVATAR}
        onCancel={() => setCropUri(null)}
        onDone={(r) => { setEditAvatarUri(r.uri); setCropUri(null); }}
      />
    </Container>
  );
}

function UserRow({ u, onPress }: { u: any; onPress: () => void }) {
  const colors = useColors();
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
