import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Header, FeedTabs, PostCard, ComposePost, Skeleton, Text, Container, FeedSidebar, Button } from '../../components';
import { ORG_ID } from '../../lib/recursiv';
import { useAuth } from '../../lib/auth';
import { usePosts } from '../../lib/hooks';
import { colors, spacing } from '../../constants/theme';

type FeedTab = 'foryou' | 'latest' | 'following';

function feedTabToSort(tab: FeedTab): 'score' | 'latest' | 'following' {
  switch (tab) {
    case 'foryou': return 'score';
    case 'latest': return 'latest';
    case 'following': return 'following';
  }
}

export default function FeedScreen() {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const [activeTab, setActiveTab] = React.useState<FeedTab>('foryou');
  const { posts, setPosts, loading, refreshing, refresh, loadMore, hasMore } = usePosts(
    feedTabToSort(activeTab)
  );

  const handleCreatePost = async (data: { content: string; title?: string; tags: string[]; media?: string }) => {
    if (!sdk) return;
    const res = await sdk.posts.create({
      content: data.content,
      title: data.title,
      tags: data.tags,
      organization_id: ORG_ID || undefined,
    });
    if (res.data) {
      setPosts(prev => [{ ...res.data, author: { name: user?.name, username: user?.username, image: user?.image } }, ...prev]);
    }
  };

  const renderPostSkeleton = () => (
    <View style={{ padding: spacing.xl, gap: spacing.md }}>
      {[1, 2, 3].map(i => (
        <View key={i} style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <Skeleton width={32} height={32} borderRadius={16} />
            <Skeleton width={120} height={14} />
          </View>
          <Skeleton height={60} />
          <Skeleton width="60%" height={12} />
        </View>
      ))}
    </View>
  );

  const { width: windowWidth } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && windowWidth > 768;

  const feedContent = (
    <>
      {loading && posts.length === 0 ? (
        renderPostSkeleton()
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={
            <ComposePost onPost={handleCreatePost} showTitle={false} />
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onVoteChange={(postId, newScore, newVote) => {
                setPosts(prev =>
                  prev.map(p =>
                    p.id === postId ? { ...p, score: newScore, userReaction: newVote } : p
                  )
                );
              }}
            />
          )}
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
                <Text variant="caption" color={colors.textMuted}>
                  You're all caught up
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            !loading ? (
              <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
                <Ionicons
                  name={activeTab === 'following' ? 'people-outline' : 'newspaper-outline'}
                  size={40}
                  color={colors.textMuted}
                />
                <Text variant="body" color={colors.textMuted} align="center">
                  {activeTab === 'following'
                    ? 'Follow people to see their posts here'
                    : 'No posts yet'}
                </Text>
                <Button
                  onPress={() =>
                    router.push(activeTab === 'following' ? '/(tabs)/explore' : '/(tabs)/create')
                  }
                  size="sm"
                >
                  {activeTab === 'following' ? 'Discover people' : 'Create your first post'}
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
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            justifyContent: 'center',
            paddingHorizontal: spacing.xl,
          }}
        >
          <View style={{ flex: 1, maxWidth: 600 }}>
            {feedContent}
          </View>
          <View style={{ width: spacing.xl }} />
          <FeedSidebar />
        </View>
      ) : (
        feedContent
      )}

      {/* Floating compose button */}
      <Pressable
        onPress={() => router.push('/(tabs)/create')}
        style={({ pressed }) => ({
          position: 'absolute',
          bottom: spacing.xl,
          right: spacing.xl,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: pressed ? colors.accentHover : colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
        })}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </Container>
  );
}
