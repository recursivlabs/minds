import * as React from 'react';
import { View, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { showToast } from '../../../components/Toast';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, PostCard, Avatar, Skeleton } from '../../../components';
import { Container } from '../../../components/Container';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { usePost, useSimilarPosts } from '../../../lib/hooks';
import { ORG_ID } from '../../../lib/recursiv';
import { setCache, invalidate } from '../../../lib/cache';
import { captureException } from '../../../lib/monitoring';
import { spacing, radius, typography } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const colors = useColors();
  const { post, setPost, loading, error } = usePost(id);
  // "More like this" — semantically related posts so the page never dead-ends.
  const { posts: similar, loading: similarLoading } = useSimilarPosts(id, 10);
  const [replies, setReplies] = React.useState<any[]>([]);
  const [repliesLoading, setRepliesLoading] = React.useState(true);
  const [replyText, setReplyText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Keep replies in sync with the post detail response WHENEVER it changes —
  // not just on first land. Previously this was keyed on post?.id and ran once
  // per post, so replies fetched by the background revalidate (yours or other
  // people's) never appeared until a full refresh. We merge by id and preserve
  // any local optimistic replies the server hasn't returned yet, so a freshly
  // posted reply is never clobbered by a lagging server list.
  // Navigating between posts reuses this screen instance, so reset replies when
  // the post id changes. Without this, the optimistic-merge below preserves the
  // PREVIOUS post's replies and they show on every subsequent post.
  React.useEffect(() => {
    setReplies([]);
    setRepliesLoading(true);
  }, [id]);

  React.useEffect(() => {
    // Ignore a stale post object from the previous route until the fetch for
    // THIS id lands — otherwise its replies would merge into the new post.
    if (!post || post.id !== id) return;
    const serverReplies = post.replies || [];
    setReplies(prev => {
      const byId = new Map<string, any>();
      for (const r of serverReplies) if (r?.id) byId.set(r.id, r);
      // Preserve only optimistic replies that belong to THIS post.
      for (const r of prev) {
        const rt = r?.reply_to_id ?? r?.replyToId ?? id;
        if (r?.id && !byId.has(r.id) && rt === id) byId.set(r.id, r);
      }
      return Array.from(byId.values()).sort((a, b) =>
        new Date(a.createdAt || a.created_at || 0).getTime() - new Date(b.createdAt || b.created_at || 0).getTime()
      );
    });
    setRepliesLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post, id]);

  const handleReply = async () => {
    if (!replyText.trim() || !sdk || !id) return;
    setSubmitting(true);
    const text = replyText.trim();
    setReplyText('');

    try {
      const res = await sdk.posts.create({
        content: text,
        reply_to_id: id,
        organization_id: ORG_ID || undefined,
      });
      if (res.data) {
        const newReply = {
          tags: [],
          reactions_count: 0,
          reply_count: 0,
          ...res.data,
          author: { id: user?.id, name: user?.name, username: user?.username, image: user?.image },
        };
        setReplies(prev => {
          const next = [...prev, newReply];
          // Persist the updated post+replies back to cache so a page refresh
          // (or navigating back into this post) doesn't bounce to the stale
          // server copy and make the new reply appear to vanish.
          setPost((prevPost: any) => {
            if (!prevPost) return prevPost;
            const updated = {
              ...prevPost,
              replies: next,
              replyCount: (prevPost.replyCount || prevPost.reply_count || 0) + 1,
              reply_count: (prevPost.reply_count || prevPost.replyCount || 0) + 1,
            };
            setCache(`post:${id}`, updated);
            return updated;
          });
          return next;
        });
        // Drop any stale feed cache so reply_count in the feed matches reality
        // after the user navigates back.
        invalidate('posts:latest:20');
        invalidate('posts:latest:50');
      }
    } catch (err) {
      // The input was cleared optimistically before the request — restore it
      // so a network blip can't destroy the user's typed reply.
      setReplyText(text);
      showToast('Reply failed — your text was restored', 'error');
      captureException(err, { action: 'reply', postId: id });
    }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Post" />
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Skeleton width={140} height={14} />
          <Skeleton height={60} />
        </View>
      </Container>
    );
  }

  if (error || !post) {
    return (
      <Container safeTop padded={false}>
        <ScreenHeader title="Post" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={colors.textMuted}>{error || 'Post not found'}</Text>
        </View>
      </Container>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
    >
      <ScreenHeader title="Post" />

      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <PostCard key={post.id} post={post} />
            {replies.length > 0 && (
              <View
                style={{
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md,
                  borderBottomWidth: 0.5,
                  borderBottomColor: colors.borderSubtle,
                }}
              >
                <Text variant="caption" color={colors.textSecondary}>
                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </Text>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} compact />}
        ListFooterComponent={
          // "More like this" — a clearly-differentiated section below the
          // replies so the post page cascades into related content instead of
          // dead-ending. Hidden until we have results (graceful empty state).
          !similarLoading && similar.length > 0 ? (
            <View style={{ marginTop: spacing.md }}>
              <View
                style={{
                  paddingHorizontal: spacing.xl,
                  paddingVertical: spacing.md,
                  backgroundColor: colors.surface,
                  borderTopWidth: 0.5,
                  borderBottomWidth: 0.5,
                  borderColor: colors.borderSubtle,
                }}
              >
                <Text variant="bodyMedium" color={colors.textSecondary}>
                  More like this
                </Text>
              </View>
              {similar.map((p: any) => (
                <PostCard key={p.id} post={p} compact />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !repliesLoading ? (
            <View style={{ alignItems: 'center', padding: spacing['3xl'] }}>
              <Text variant="body" color={colors.textMuted}>No replies yet</Text>
            </View>
          ) : (
            <View style={{ padding: spacing.xl, gap: spacing.md }}>
              {[1, 2].map(i => <Skeleton key={i} height={60} />)}
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Reply input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          gap: spacing.sm,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderTopWidth: 0.5,
          borderTopColor: colors.borderSubtle,
          paddingBottom: insets.bottom || spacing.md,
        }}
      >
        <TextInput
          placeholder="Write a reply..."
          placeholderTextColor={colors.textMuted}
          value={replyText}
          onChangeText={setReplyText}
          multiline
          onKeyPress={(e: any) => {
            if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey) {
              e.preventDefault();
              handleReply();
            }
          }}
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
            borderRadius: radius.lg,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            color: colors.text,
            maxHeight: 100,
            ...typography.body,
            ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
          }}
        />
        <Pressable
          onPress={handleReply}
          disabled={!replyText.trim() || submitting}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: replyText.trim() ? (pressed ? colors.accentHover : colors.accent) : colors.surfaceHover,
            alignItems: 'center',
            justifyContent: 'center',
          })}
        >
          <Ionicons name="send" size={16} color={replyText.trim() ? '#fff' : colors.textMuted} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
