import * as React from 'react';
import { View, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, PostCard, Avatar, Skeleton } from '../../../components';
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

  React.useEffect(() => {
    if (!id || !sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.posts.list({ limit: 50, organization_id: ORG_ID || undefined });
        const postReplies = (res.data || []).filter(
          (p: any) => p.parentId === id || p.parent_id === id || p.reply_to_id === id || p.replyToId === id
        );
        if (!cancelled) setReplies(postReplies);
      } catch {}
      finally { if (!cancelled) setRepliesLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [id, sdk]);

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
      }
    } catch {}
    finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3">Post</Text>
        </View>
        <View style={{ padding: spacing.xl, gap: spacing.lg }}>
          <Skeleton width={140} height={14} />
          <Skeleton height={60} />
        </View>
      </View>
    );
  }

  if (error || !post) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3">Post</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="body" color={colors.textMuted}>{error || 'Post not found'}</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}
    >
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
        <Text variant="h3">Post</Text>
      </View>

      <FlatList
        data={replies}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View>
            <PostCard post={post} />
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
