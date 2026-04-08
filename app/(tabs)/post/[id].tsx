import * as React from 'react';
import { View, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, PostCard, Avatar, Skeleton } from '../../../components';
import { Container } from '../../../components/Container';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { useAuth } from '../../../lib/auth';
import { usePost } from '../../../lib/hooks';
import { ORG_ID } from '../../../lib/recursiv';
import { colors, spacing, radius, typography } from '../../../constants/theme';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { post, setPost, loading, error } = usePost(id);
  const [replies, setReplies] = React.useState<any[]>([]);
  const [repliesLoading, setRepliesLoading] = React.useState(true);
  const [replyText, setReplyText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  // Use replies from the post detail response (server returns them)
  React.useEffect(() => {
    if (!post) return;
    const postReplies = post.replies || [];
    setReplies(postReplies);
    setRepliesLoading(false);
  }, [post]);

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
        setReplies(prev => [
          ...prev,
          { ...res.data, author: { name: user?.name, username: user?.username, image: user?.image } },
        ]);
        setPost((prev: any) => prev ? { ...prev, replyCount: (prev.replyCount || prev.reply_count || 0) + 1 } : prev);
      }
    } catch {}
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
                  borderBottomColor: 'rgba(255,255,255,0.06)',
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
          borderTopColor: 'rgba(255,255,255,0.06)',
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
