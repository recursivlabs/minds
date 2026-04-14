import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, FeedTabs, PostCard, Text, Container, FeedSidebar, Button, Avatar } from '../../components';
import { FeedSkeletons } from '../../components/PostSkeleton';
import { OnboardingFlow, useOnboarding } from '../../components/Onboarding';
import { ORG_ID } from '../../lib/recursiv';
import { useAuth } from '../../lib/auth';
import { usePosts } from '../../lib/hooks';
import { registerShortcut } from '../../lib/keyboard';
import { colors, spacing } from '../../constants/theme';

type FeedTab = 'foryou' | 'latest' | 'following' | 'trending';

export default function FeedScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { showOnboarding, completeOnboarding } = useOnboarding();
  const [activeTab, setActiveTab] = React.useState<FeedTab>('foryou');

  const sortMap = { foryou: 'score', latest: 'latest', following: 'following', trending: 'score' } as const;
  const { posts, setPosts, loading: postsLoading, refreshing, refresh, loadMore, hasMore } = usePosts(sortMap[activeTab] as any);

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

  // Onboarding check — MUST be after all hooks
  if (showOnboarding) {
    return <OnboardingFlow onComplete={completeOnboarding} />;
  }

  const profileIncomplete = user && (!user.image && !user.bio);
  const [nudgeDismissed, setNudgeDismissed] = React.useState(false);

  const feedContent = (
    <>
      {postsLoading && posts.length === 0 ? (
        <FeedSkeletons count={5} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={7}
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
              {profileIncomplete && !nudgeDismissed && (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                  backgroundColor: colors.surface,
                  borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
                }}>
                  <Pressable onPress={() => router.push('/(tabs)/profile')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 }}>
                    <Ionicons name="person-circle-outline" size={28} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" color={colors.text}>Complete your profile</Text>
                      <Text variant="caption" color={colors.textMuted}>Add a photo and bio so people can find you</Text>
                    </View>
                  </Pressable>
                  <Pressable onPress={() => setNudgeDismissed(true)} hitSlop={12}>
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
            !postsLoading ? (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing['6xl'], gap: spacing['2xl'] }}>
                <Ionicons name={activeTab === 'following' ? 'people-outline' : 'newspaper-outline'} size={40} color={colors.accent} />
                <Text variant="h2" color={colors.text} align="center">
                  {activeTab === 'following' ? 'Following' : activeTab === 'foryou' ? 'Welcome to Minds' : 'Latest'}
                </Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  {activeTab === 'following' ? 'Follow people to see their posts here.' : 'No posts yet. Be the first.'}
                </Text>
                <Button onPress={() => router.push(activeTab === 'following' ? '/(tabs)/explore' : '/(tabs)/create')} size="sm">
                  {activeTab === 'following' ? 'Discover people' : 'Create a post'}
                </Button>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </>
  );

  return (
    <Container safeTop padded={false} maxWidth={isDesktopWeb ? undefined : 600}>
      <Header />
      <FeedTabs active={activeTab} onChange={setActiveTab} />

      {isDesktopWeb ? (
        <View style={{ flex: 1, flexDirection: 'row', paddingHorizontal: spacing.xl }}>
          <View style={{ flex: 1 }}>{feedContent}</View>
          <View style={{ width: spacing.xl }} />
          <View style={{ width: 340 }}><FeedSidebar /></View>
        </View>
      ) : (
        feedContent
      )}

      <Pressable
        onPress={() => router.push('/(tabs)/create')}
        style={({ pressed }) => ({
          position: 'absolute', bottom: spacing.xl, right: spacing.xl,
          width: 56, height: 56, borderRadius: 28,
          backgroundColor: pressed ? colors.accentHover : colors.accent,
          alignItems: 'center', justifyContent: 'center',
          elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8,
        })}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </Container>
  );
}
