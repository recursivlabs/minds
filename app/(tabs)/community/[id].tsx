import * as React from 'react';
import { View, FlatList, Pressable, ActivityIndicator, Alert, TextInput, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Button, PostCard, Skeleton } from '../../../components';
import { Container } from '../../../components/Container';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { ORG_ID } from '../../../lib/recursiv';
import { colors, spacing, radius } from '../../../constants/theme';

export default function CommunityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { sdk, user } = useAuth();

  const [community, setCommunity] = React.useState<any>(null);
  const [posts, setPosts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [postsLoading, setPostsLoading] = React.useState(true);
  const [isMember, setIsMember] = React.useState(false);
  const [joinLoading, setJoinLoading] = React.useState(false);
  const [showModMenu, setShowModMenu] = React.useState(false);
  const [editMode, setEditMode] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editDesc, setEditDesc] = React.useState('');
  const [hasMore, setHasMore] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const offsetRef = React.useRef(0);
  const isCreator = community?.created_by?.id === user?.id || community?.createdBy?.id === user?.id;

  // Load community details
  React.useEffect(() => {
    if (!id || !sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.communities.get(id);
        if (!cancelled && res.data) {
          setCommunity(res.data);
          setIsMember(!!(res.data as any).is_member || !!(res.data as any).isMember);
        }
      } catch (err: any) {
        if (!cancelled) setCommunity(null);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id, sdk]);

  // Load community posts with pagination
  const PAGE_SIZE = 20;

  const fetchPosts = React.useCallback(async (refresh = true) => {
    if (!sdk || !community?.id) return;
    if (refresh) offsetRef.current = 0;
    try {
      const res = await sdk.posts.list({
        limit: PAGE_SIZE,
        offset: refresh ? 0 : offsetRef.current,
        organization_id: ORG_ID || undefined,
        community_id: community.id,
      } as any);
      const data = res.data || [];
      if (refresh) {
        setPosts(data);
      } else {
        setPosts(prev => {
          const ids = new Set(prev.map((p: any) => p.id));
          return [...prev, ...data.filter((p: any) => !ids.has(p.id))];
        });
      }
      offsetRef.current = (refresh ? 0 : offsetRef.current) + data.length;
      setHasMore(res.meta?.has_more ?? data.length === PAGE_SIZE);
    } catch (e) { /* community posts fetch failed — show empty state */ }
    setPostsLoading(false);
    setLoadingMore(false);
  }, [sdk, community?.id]);

  const loadMore = React.useCallback(() => {
    if (hasMore && !postsLoading && !loadingMore) {
      setLoadingMore(true);
      fetchPosts(false);
    }
  }, [hasMore, postsLoading, loadingMore, fetchPosts]);

  React.useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Refetch posts when returning from create screen
  useFocusEffect(React.useCallback(() => {
    if (community?.id) fetchPosts();
  }, [community?.id, fetchPosts]));

  const handleJoinLeave = async () => {
    if (!sdk || !community?.id) return;
    setJoinLoading(true);
    const wasMember = isMember;
    setIsMember(!wasMember);
    try {
      if (wasMember) await sdk.communities.leave(community.id);
      else await sdk.communities.join(community.id);
    } catch {
      setIsMember(wasMember);
    }
    setJoinLoading(false);
  };

  if (loading) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="" />
        <View style={{ padding: spacing.xl, gap: spacing.lg, alignItems: 'center' }}>
          <Skeleton width={56} height={56} borderRadius={28} />
          <Skeleton width={180} height={20} />
        </View>
      </Container>
    );
  }

  if (!community) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Community" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
          <Ionicons name="people-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text}>Community not found</Text>
          <Text variant="body" color={colors.textSecondary} style={{ maxWidth: 300, textAlign: 'center' }}>
            This community may have been removed or the link is incorrect.
          </Text>
        </View>
      </Container>
    );
  }

  const memberCount = community.member_count || community.memberCount || 0;
  const postCount = community.post_count || community.postCount || 0;

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title={community.name} />

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            {/* Community info */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
              <Avatar uri={community.image || community.avatar} name={community.name} size="xl" />
              <View style={{ flex: 1 }}>
                <Text variant="h2">{community.name}</Text>
                <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.xs }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="people-outline" size={14} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>{memberCount}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                    <Ionicons name="newspaper-outline" size={14} color={colors.textMuted} />
                    <Text variant="caption" color={colors.textMuted}>{postCount}</Text>
                  </View>
                </View>
              </View>
            </View>

            {community.description && (
              <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
                {community.description}
              </Text>
            )}

            {/* Actions */}
            <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
              <Button
                onPress={handleJoinLeave}
                loading={joinLoading}
                variant={isMember ? 'secondary' : 'primary'}
                size="sm"
              >
                {isMember ? 'Joined' : 'Join'}
              </Button>
              <Button
                onPress={() => router.push({ pathname: '/(tabs)/create', params: { communityId: community.id, communityName: community.name } } as any)}
                variant="secondary"
                size="sm"
              >
                Create Post
              </Button>
              {isCreator && (
                <Button
                  onPress={() => setShowModMenu(!showModMenu)}
                  variant="ghost"
                  size="sm"
                >
                  Manage
                </Button>
              )}
            </View>

            {/* Mod menu for community creator */}
            {showModMenu && isCreator && (
              <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.borderSubtle }}>
                <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>Moderation</Text>
                {editMode ? (
                  <View style={{ gap: spacing.sm }}>
                    <TextInput
                      placeholder="Community name"
                      placeholderTextColor={colors.textMuted}
                      value={editName}
                      onChangeText={setEditName}
                      style={{ backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, fontSize: 15, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
                    />
                    <TextInput
                      placeholder="Description"
                      placeholderTextColor={colors.textMuted}
                      value={editDesc}
                      onChangeText={setEditDesc}
                      multiline
                      style={{ backgroundColor: colors.bg, borderWidth: 0.5, borderColor: colors.glassBorder, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10, color: colors.text, fontSize: 15, minHeight: 60, textAlignVertical: 'top', ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}) }}
                    />
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      <Button
                        onPress={async () => {
                          if (!sdk || !community?.id) return;
                          try {
                            await (sdk.communities as any).update(community.id, { name: editName.trim(), description: editDesc.trim() });
                            setCommunity((prev: any) => prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : prev);
                            setEditMode(false);
                          } catch { Alert.alert('Error', 'Could not update community'); }
                        }}
                        size="sm"
                      >Save</Button>
                      <Button onPress={() => setEditMode(false)} variant="secondary" size="sm">Cancel</Button>
                    </View>
                  </View>
                ) : (
                  <Button onPress={() => { setEditName(community.name || ''); setEditDesc(community.description || ''); setEditMode(true); }} variant="ghost" size="sm">
                    Edit Community
                  </Button>
                )}
                <Button
                  onPress={async () => {
                    if (!sdk || !community?.id) return;
                    try {
                      const res = await sdk.communities.members(community.id, { limit: 50 });
                      const members = res.data || [];
                      Alert.alert('Members', members.map((m: any) => m.user?.name || m.name || 'Unknown').join('\n') || 'No members');
                    } catch { Alert.alert('Error', 'Could not load members'); }
                  }}
                  variant="ghost"
                  size="sm"
                >
                  View Members ({memberCount})
                </Button>
                <Button
                  onPress={async () => {
                    Alert.alert(
                      'Delete Community',
                      'This will permanently delete this community and all its content.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              await sdk.communities.delete(community.id);
                              router.back();
                            } catch { Alert.alert('Error', 'Could not delete community'); }
                          },
                        },
                      ]
                    );
                  }}
                  variant="ghost"
                  size="sm"
                  accentColor={colors.error}
                >
                  Delete Community
                </Button>
              </View>
            )}

            {/* Separator */}
            <View style={{ borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }} />

            {/* Posts header */}
            <Text variant="label" color={colors.textMuted}>Posts</Text>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} compact canModerate={isCreator} />}
        ListEmptyComponent={
          !postsLoading ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
              <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
              <Text variant="h2" color={colors.text}>No posts yet</Text>
              <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>
                Be the first to post in this community.
              </Text>
              <Button onPress={() => router.push('/(tabs)/create')} size="sm">
                Create Post
              </Button>
            </View>
          ) : (
            <View style={{ padding: spacing.xl, alignItems: 'center' }}>
              <ActivityIndicator color={colors.accent} />
            </View>
          )
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? (
          <View style={{ padding: spacing.xl, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : null}
        showsVerticalScrollIndicator={false}
      />
    </Container>
  );
}
