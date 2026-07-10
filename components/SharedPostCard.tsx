import * as React from 'react';
import { View, Pressable, Image, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { useColors } from '../lib/theme';
import { spacing, radius } from '../constants/theme';
import { getCached, setCache } from '../lib/cache';
import { postThumb } from '../lib/discover';

/**
 * A Minds post shared into a chat, rendered as a rich embed (author + snippet +
 * thumbnail) that taps back to the post — X/IG parity for shared links.
 */
export function SharedPostCard({ postId }: { postId: string }) {
  const colors = useColors();
  const router = useRouter();
  const { sdk } = useAuth();
  const [post, setPost] = React.useState<any>(() => getCached(`post:${postId}`) || null);

  React.useEffect(() => {
    if (post || !sdk || !postId) return;
    let cancelled = false;
    (sdk as any).posts?.get?.(postId).then((r: any) => {
      if (!cancelled && r?.data) { setPost(r.data); setCache(`post:${postId}`, r.data); }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [sdk, postId, post]);

  const author = post?.author || post?.user || {};
  const name = author.name || author.username || 'Minds post';
  const text = String(post?.content || post?.body || post?.title || '').trim();
  const thumb = post ? postThumb(post).url : null;

  return (
    <Pressable
      onPress={() => router.push(`/(tabs)/post/${postId}` as any)}
      style={({ pressed, hovered }: any) => ({
        borderWidth: 0.5, borderColor: colors.borderSubtle, borderRadius: radius.md,
        overflow: 'hidden', backgroundColor: pressed || hovered ? colors.surfaceHover : colors.surface,
        minWidth: 220, maxWidth: 300,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={{ width: '100%', height: 120, backgroundColor: colors.surfaceHover }} resizeMode="cover" />
      ) : null}
      <View style={{ padding: spacing.md, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Avatar uri={author.image || author.avatar} name={name} size="xs" />
          <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1, fontWeight: '600' }}>{name}</Text>
        </View>
        {text ? (
          <Text variant="caption" color={colors.text} numberOfLines={3} style={{ lineHeight: 17 }}>{text}</Text>
        ) : (
          <Text variant="caption" color={colors.textMuted}>{post ? 'View post' : 'Loading post…'}</Text>
        )}
        <Text variant="caption" color={colors.accent} style={{ fontSize: 11 }}>Open on Minds ›</Text>
      </View>
    </Pressable>
  );
}
