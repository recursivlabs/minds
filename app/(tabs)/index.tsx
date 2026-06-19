import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, useFocusEffect, useNavigation, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, FeedTabs, PostCard, Text, Container, FeedSidebar, Button, Avatar } from '../../components';
import { FeedSkeletons } from '../../components/PostSkeleton';
import { ORG_ID } from '../../lib/recursiv';
import { useAuth } from '../../lib/auth';
import { usePosts } from '../../lib/hooks';
import { getPreference } from '../../lib/preferences';
import { registerShortcut } from '../../lib/keyboard';
import { getItem, setItem } from '../../lib/storage';
import { loadPreferences, isAgentCtaDismissed, markAgentCtaDismissed, isAgentSetUp } from '../../lib/onboarding';
import { MINDS_PERSONAL_AGENT_SYSTEM_PROMPT } from '../../lib/curator/prompts';
import { spacing, radius } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { resolvePersonalAgent } from '../../lib/resolvePersonalAgent';

const PROFILE_NUDGE_DISMISSED_KEY = 'minds:profileNudge:dismissed';
type FeedTab = 'foryou' | 'following';

export default function FeedScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();
  // Honor the user's saved default. New accounts land on 'foryou'; if
  // a user flips the preference in Settings, this is what runs on
  // every cold open.
  const [activeTab, setActiveTab] = React.useState<FeedTab>(() => getPreference('defaultFeed'));
  // Allow other screens to deep-link a tab (e.g. the composer sends you to
  // 'following' after posting so you see your new post).
  const params = useLocalSearchParams<{ tab?: string }>();
  React.useEffect(() => {
    if (params.tab === 'following' || params.tab === 'foryou') setActiveTab(params.tab);
  }, [params.tab]);
  const [nudgeDismissed, setNudgeDismissed] = React.useState(true); // start true to avoid flash before storage read

  // Load persisted nudge dismissal so it stays dismissed across refreshes.
  React.useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const stored = await getItem(`${PROFILE_NUDGE_DISMISSED_KEY}:${user.id}`);
      setNudgeDismissed(stored === 'true');
    })();
  }, [user?.id]);

  const dismissNudge = React.useCallback(() => {
    setNudgeDismissed(true);
    if (user?.id) {
      setItem(`${PROFILE_NUDGE_DISMISSED_KEY}:${user.id}`, 'true');
    }
  }, [user?.id]);

  // Calibration nudge: legacy users land on For You with no saved taste
  // Agent-setup CTA: show at top of For You feed when user has no
  // personal agent AND hasn't dismissed. Once they set one up OR dismiss,
  // it stays gone. Hard-default to "hide" so we don't flash the CTA
  // before storage + agents.list resolve.
  const [agentCtaState, setAgentCtaState] = React.useState<'hidden' | 'show'>('hidden');

  React.useEffect(() => {
    if (!user?.id || !sdk) return;
    let active = true;
    (async () => {
      const [dismissed, setUp, personal] = await Promise.all([
        isAgentCtaDismissed(),
        isAgentSetUp(),
        resolvePersonalAgent(sdk).catch(() => null),
      ]);
      if (!active) return;
      // The For You feed is now ranked server-side by the recommender — it no
      // longer requires the user to set up a personal agent, so the setup CTA
      // is retired. (The personal agent still exists as an optional DM /
      // ask-agent surface, just not a feed prerequisite.)
      void dismissed; void setUp; void personal;
      setAgentCtaState('hidden');

      // One-time persona heal: some personal agents were provisioned with the
      // generic org (sales/SDR) system prompt, so they mis-describe their role
      // ("I'm your SDR…"). If the current prompt is empty or sales-flavoured,
      // stamp the Minds curator persona once. Guarded by a storage flag and a
      // marker test so we never clobber a user's deliberately customised voice.
      if (personal) {
        const curPrompt = String(personal.ai_system_prompt || personal.aiSystemPrompt || '');
        const looksWrong = !curPrompt.trim() || /\b(SDR|Apollo|outbound|lead[-\s]?gen|sales pipeline|CRM)\b/i.test(curPrompt);
        const alreadyHealed = await getItem('minds:agentPersonaHealed');
        if (looksWrong && alreadyHealed !== '1' && active) {
          try {
            await (sdk as any).agents.ensurePersonal({ overrides: { system_prompt: MINDS_PERSONAL_AGENT_SYSTEM_PROMPT } });
            await setItem('minds:agentPersonaHealed', '1');
          } catch {}
        }
      }
    })();
    return () => { active = false; };
  }, [user?.id, sdk]);

  const dismissAgentCta = React.useCallback(() => {
    setAgentCtaState('hidden');
    void markAgentCtaDismissed();
  }, []);

  // For You uses the personal-agent curator feed. When the user has
  // disabled AI in Settings, fall back to chronological so they still
  // see content but no agent surfaces.
  const aiEnabled = getPreference('aiEnabled');
  const sortMap = {
    foryou: aiEnabled ? 'personal' : 'latest',
    following: 'following',
  } as const;
  const { posts, setPosts, loading: postsLoading, error: feedError, refreshing, refresh, loadMore, hasMore } = usePosts(sortMap[activeTab] as any);

  // For You is ranked server-side by the recommender now — pull-to-refresh just
  // re-fetches (which re-ranks). No more "your agent is curating…" banner.

  // Horizontal-swipe nav between feed filters. Pan past 60px without
  // significant vertical drift cycles to the next/previous tab. Vertical
  // scrolling on the FlatList is unaffected because Pan only activates
  // when the gesture's horizontal motion clearly dominates.
  const FEED_TAB_ORDER: FeedTab[] = ['foryou', 'following'];
  const swipeGesture = React.useMemo(
    () => Gesture.Pan()
      .activeOffsetX([-15, 15])
      .failOffsetY([-12, 12])
      .onEnd((evt) => {
        const dx = evt.translationX;
        if (Math.abs(dx) < 60) return;
        const idx = FEED_TAB_ORDER.indexOf(activeTab);
        if (idx < 0) return;
        const nextIdx = dx < 0 ? idx + 1 : idx - 1;
        if (nextIdx < 0 || nextIdx >= FEED_TAB_ORDER.length) return;
        // setActiveTab needs to run on the JS thread.
        setActiveTab(FEED_TAB_ORDER[nextIdx]);
      })
      .runOnJS(true),
    [activeTab],
  );

  // Fresh-since-last-visit: track when the user last opened the feed,
  // then count posts created since that moment for a small "new
  // content" dot on the For You tab. Stored in AsyncStorage so it
  // persists across app launches. Updated when the user opens the feed
  // (we mark "now" as last-visit on tab focus).
  const [lastVisitAt, setLastVisitAt] = React.useState<number | null>(null);
  const FEED_LAST_VISIT_KEY = 'minds:feed:lastVisitAt';
  React.useEffect(() => {
    if (!user?.id) return;
    let active = true;
    (async () => {
      const stored = await getItem(`${FEED_LAST_VISIT_KEY}:${user.id}`);
      if (!active) return;
      const ts = stored ? Number(stored) : null;
      setLastVisitAt(Number.isFinite(ts as any) ? (ts as any) : null);
      // Mark this open as "now" — only after we've read the previous
      // value, so the count below reflects posts since the LAST visit
      // not this one.
      setItem(`${FEED_LAST_VISIT_KEY}:${user.id}`, String(Date.now()));
    })();
    return () => { active = false; };
  }, [user?.id]);

  const freshCounts = React.useMemo(() => {
    if (!lastVisitAt) return undefined;
    // The fresh-content dot only makes sense on For You (a curated stream of
    // posts you haven't seen). On Following it lit up from your OWN new post,
    // which is nonsensical — so never show it there, and never count your own
    // posts toward it on any tab.
    if ((sortMap[activeTab] === 'personal' ? 'foryou' : activeTab) !== 'foryou') return undefined;
    const since = lastVisitAt;
    const count = (posts || []).filter((p: any) => {
      const ts = new Date(p.createdAt || p.created_at || 0).getTime();
      const authorId = p.author?.id || p.authorId || p.user_id;
      return ts > since && authorId !== user?.id;
    }).length;
    if (count === 0) return undefined;
    return { foryou: count } as any;
  }, [posts, lastVisitAt, activeTab, user?.id]);

  // Tap the Feed tab while already on Feed → scroll the list to the top.
  // Standard X / Twitter / Instagram behavior.
  const listRef = React.useRef<FlatList<any> | null>(null);
  const navigation = useNavigation();
  React.useEffect(() => {
    const unsub = (navigation as any).addListener?.('tabPress', () => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsub;
  }, [navigation]);

  // Per-tab scroll memory. When the user switches between For You and
  // Following and back, restore the offset they left. iMessage / X
  // expectation: tabs feel like separate stacks, not one shared scroll.
  const scrollOffsets = React.useRef<Record<FeedTab, number>>({ foryou: 0, following: 0 });
  const prevTabRef = React.useRef<FeedTab>(activeTab);
  React.useEffect(() => {
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    const offset = scrollOffsets.current[activeTab] || 0;
    // Defer one tick so the new tab's list has mounted with its data.
    const t = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset, animated: false });
    }, 0);
    return () => clearTimeout(t);
  }, [activeTab]);


  // Live "new posts" pill (X/Bluesky parity). The server fans out a
  // 'feed_update' event to org members whenever someone posts; we count them
  // and surface a tap-to-load banner instead of making the user pull-to-refresh
  // to discover there's new content.
  const [newPostsAvailable, setNewPostsAvailable] = React.useState(0);
  React.useEffect(() => {
    if (!sdk) return;
    let cleanup: (() => void) | undefined;
    (async () => {
      try {
        await sdk.realtime.connect();
        const sock = (sdk as any).realtime?.socket;
        if (!sock) return;
        const onFeedUpdate = (data: any) => {
          // Never count your OWN posts — you already see them the moment you
          // post. Only OTHERS' new posts make the pill a real "fresh content
          // arrived while you're here" signal (X-style).
          const authorId = data?.authorId || data?.author_id || data?.author?.id;
          if (authorId && user?.id && authorId === user.id) return;
          setNewPostsAvailable(n => Math.min(n + 1, 99));
        };
        sock.on('feed_update', onFeedUpdate);
        cleanup = () => sock.off?.('feed_update', onFeedUpdate);
      } catch {}
    })();
    return () => { cleanup?.(); };
  }, [sdk, user?.id]);
  // Reset the counter when switching tabs (each tab is its own stream).
  React.useEffect(() => { setNewPostsAvailable(0); }, [activeTab]);
  const loadNewPosts = React.useCallback(() => {
    setNewPostsAvailable(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    refresh();
  }, [refresh]);

  // Keyboard shortcuts
  React.useEffect(() => {
    const unsubs = [
      registerShortcut('n', () => router.push('/(tabs)/create')),
      registerShortcut('/', () => router.push('/(tabs)/discover' as any)),
      registerShortcut('g', () => router.push('/(tabs)/chat')),
      registerShortcut('escape', () => refresh()),
    ];
    return () => unsubs.forEach(u => u());
  }, [router, refresh]);

  // Refetch posts when returning from create screen
  useFocusEffect(React.useCallback(() => { refresh(); }, [refresh]));

  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth > 1024;

  // Show nudge when EITHER avatar or bio is missing (not both). Auto-hides
  // when profile is fully populated, regardless of whether the user
  // previously dismissed.
  const profileIncomplete = Boolean(user && (!user.image || !user.bio?.trim()));

  const feedContent = (
    <>
      {newPostsAvailable > 0 && (
        <Pressable
          onPress={loadNewPosts}
          style={({ pressed }) => ({
            position: 'absolute',
            top: spacing.md,
            alignSelf: 'center',
            zIndex: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.full,
            backgroundColor: colors.accent,
            opacity: pressed ? 0.9 : 1,
            ...(Platform.OS === 'web' ? { cursor: 'pointer', boxShadow: '0 2px 10px rgba(0,0,0,0.22)' } as any : {}),
          })}
        >
          <Ionicons name="arrow-up" size={15} color={colors.textOnAccent} />
          <Text variant="caption" color={colors.textOnAccent} style={{ fontFamily: 'Roboto-Medium' }}>
            {newPostsAvailable >= 99 ? '99+' : newPostsAvailable} new post{newPostsAvailable === 1 ? '' : 's'}
          </Text>
        </Pressable>
      )}
      {postsLoading && posts.length === 0 ? (
        <FeedSkeletons count={5} />
      ) : feedError && posts.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['2xl'], gap: spacing.lg }}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
          <Text variant="body" color={colors.textSecondary} align="center">Couldn't load your feed.</Text>
          <Pressable
            onPress={() => refresh()}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full,
              backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text variant="bodyMedium" color={colors.textOnAccent}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={posts}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={7}
          // Throttled scroll capture for per-tab offset memory.
          onScroll={(e) => {
            scrollOffsets.current[activeTab] = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={250}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              compact
              onVoteChange={(postId, newScore, newVote) => {
                setPosts(prev => prev.map(p => p.id === postId ? { ...p, score: newScore, userReaction: newVote } : p));
              }}
            />
          )}
          ListHeaderComponent={
            <>
              {activeTab === 'foryou' && agentCtaState === 'show' && (
                <Pressable
                  onPress={() => router.push('/agent' as any)}
                  style={({ pressed }) => ({
                    paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                    backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                    gap: spacing.md,
                  })}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
                    <Ionicons name="sparkles" size={22} color={colors.accent} style={{ marginTop: 2 }} />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text variant="bodyMedium" color={colors.text}>Set up your personal AI agent</Text>
                      <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>
                        Your agent can curate this feed and help with anything you need on Minds. You control everything.
                      </Text>
                    </View>
                    <Pressable onPress={(e) => { e.stopPropagation?.(); dismissAgentCta(); }} hitSlop={12}>
                      <Ionicons name="close" size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: 34 }}>
                    <View style={{
                      paddingHorizontal: spacing.md, paddingVertical: 6,
                      borderRadius: 999, backgroundColor: colors.accent,
                    }}>
                      <Text variant="caption" color="#ffffff">Set up</Text>
                    </View>
                    <Pressable onPress={(e) => { e.stopPropagation?.(); dismissAgentCta(); }}>
                      <Text variant="caption" color={colors.textMuted}>Not now</Text>
                    </Pressable>
                  </View>
                </Pressable>
              )}
              {profileIncomplete && !nudgeDismissed && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  backgroundColor: colors.surface,
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                }}>
                  <Pressable onPress={() => {
                    // Prefer user.id (UUID, always URL-safe) over username.
                    // Right after signup the client may still hold an email-derived
                    // fallback like `jack+minds+1` which 404s when looked up by
                    // username. The profile route falls back to ID lookup if
                    // getByUsername fails, so passing the UUID always resolves.
                    const slug = user?.id || user?.username;
                    router.push(slug ? `/(tabs)/user/${slug}` as any : '/(tabs)/profile');
                  }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" color={colors.text}>Complete your profile</Text>
                      <Text variant="caption" color={colors.textMuted}>Add a photo and bio so people can find you</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={dismissNudge} hitSlop={12}>
                    <Ionicons name="close" size={18} color={colors.textMuted} />
                  </Pressable>
                </View>
              )}
              <Pressable
                onPress={() => router.push('/(tabs)/create')}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                  backgroundColor: pressed ? colors.surfaceHover : 'transparent',
                })}
              >
                <Avatar uri={user?.image} name={user?.name} size="sm" />
                <Text variant="body" color={colors.textMuted}>What's on your mind?</Text>
              </Pressable>
            </>
          }
          onRefresh={refresh}
          refreshing={refreshing}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore && posts.length > 0 ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : posts.length > 0 ? (
              <View style={{ padding: spacing['3xl'], alignItems: 'center' }}>
                <Text variant="caption" color={colors.textMuted}>You're all caught up</Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            // While the feed is loading the first time, show post-shaped
            // skeletons (not a centered spinner). Spinner-replacing-list
            // looks broken; skeleton makes it feel like content is on
            // the way. Empty-state hero only renders once loading is
            // done AND the result is genuinely empty.
            postsLoading ? (
              <FeedSkeletons count={4} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['6xl'], gap: spacing['2xl'] }}>
                <Ionicons name={activeTab === 'foryou' || activeTab === 'following' ? 'people-outline' : 'newspaper-outline'} size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">
                  {activeTab === 'foryou' ? 'Build your feed' : activeTab === 'following' ? 'Nothing here yet' : 'No posts yet'}
                </Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  {activeTab === 'foryou'
                    ? 'Follow people and explore communities to fill your feed with great posts.'
                    : activeTab === 'following'
                      ? 'Follow people to see their posts here.'
                      : 'Be the first to post.'}
                </Text>
                <View style={{ alignSelf: 'center' }}>
                  {activeTab === 'foryou' || activeTab === 'following' ? (
                    <Button onPress={() => router.push('/(tabs)/discover')} size="sm">Discover people</Button>
                  ) : (
                    <Button onPress={() => router.push('/(tabs)/create')} size="sm">Write a post</Button>
                  )}
                </View>
              </View>
            )
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );

  const feedTabsRow = (
    <FeedTabs active={activeTab} onChange={setActiveTab} unread={freshCounts} />
  );

  return (
    <Container safeTop padded={false} maxWidth={isDesktopWeb ? undefined : 600}>
      <Header />
      {isDesktopWeb ? (
        // X/Bluesky desktop: [timeline (≤600) | rail (340)] filling the content
        // column. The whole nav + content group is centered by the app shell.
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <View style={{ flex: 1, maxWidth: 600, minWidth: 0 }}>
            {feedTabsRow}
            <View style={{ flex: 1 }}>{feedContent}</View>
          </View>
          <View style={{ width: spacing.xl }} />
          <View style={{ width: 340 }}><FeedSidebar /></View>
        </View>
      ) : (
        <>
          {feedTabsRow}
          <GestureDetector gesture={swipeGesture}>
            <View style={{ flex: 1 }}>{feedContent}</View>
          </GestureDetector>
        </>
      )}

      {/* Floating compose button — mobile only; on web the sidebar has Create. */}
      {Platform.OS !== 'web' && (
        <Pressable
          onPress={() => router.push('/(tabs)/create')}
          style={({ pressed }) => ({
            position: 'absolute', bottom: spacing.xl, right: spacing.xl,
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: pressed ? colors.accentHover : colors.accent,
            alignItems: 'center', justifyContent: 'center',
            elevation: 4, shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8,
          })}
        >
          <Ionicons name="add" size={28} color={colors.textOnAccent} />
        </Pressable>
      )}
    </Container>
  );
}
