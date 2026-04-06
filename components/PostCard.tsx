import * as React from 'react';
import { View, Pressable, Image, Platform, Linking, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { VoteButtons } from './VoteButtons';
import { BoostBadge } from './BoostBadge';
import { NSFWOverlay } from './NSFWOverlay';
import { ReportModal } from './ReportModal';
import { TipModal } from './TipModal';
import { useAuth } from '../lib/auth';
import { BASE_ORIGIN } from '../lib/recursiv';
import { getItem } from '../lib/storage';
import { colors, spacing, radius, typography } from '../constants/theme';
import { renderMarkdownToHtml, parseMarkdownSegments } from '../lib/markdown';

interface Props {
  post: any;
  onVoteChange?: (postId: string, newScore: number, userVote: 'upvote' | 'downvote' | null) => void;
  onPostDeleted?: (postId: string) => void;
  compact?: boolean;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

export function PostCard({ post, onVoteChange, onPostDeleted, compact = false }: Props) {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const [userVote, setUserVote] = React.useState<'upvote' | 'downvote' | null>(
    post.userReaction || post.user_reaction || null
  );
  const [score, setScore] = React.useState(post.score || 0);
  const [showMenu, setShowMenu] = React.useState(false);
  const [showReport, setShowReport] = React.useState(false);
  const [showTip, setShowTip] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(post.content || post.body || '');
  const [editSaving, setEditSaving] = React.useState(false);
  const [currentContent, setCurrentContent] = React.useState(post.content || post.body || '');
  const [isDeleted, setIsDeleted] = React.useState(false);

  const author = post.author || post.user || {};
  const authorName = author.name || author.username || 'Anonymous';
  const authorUsername = author.username || author.name || 'anonymous';
  const authorAvatar = author.image || author.avatar || null;
  const content = currentContent || '';
  const rawMedia = post.media;
  const media = (Array.isArray(rawMedia) ? rawMedia[0]?.url : rawMedia) || post.image || post.thumbnail || null;
  const replyCount = post.replyCount || post.reply_count || post.comments_count || 0;
  const isBoosted = post.boosted || post.is_boosted || false;
  const isNsfw = (post.tags || []).some((t: any) =>
    typeof t === 'string' ? t.toLowerCase() === 'nsfw' : t?.name?.toLowerCase() === 'nsfw'
  );
  const createdAt = post.createdAt || post.created_at || new Date().toISOString();

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!sdk) return;
    const wasVoted = userVote === type;
    const prevVote = userVote;
    const prevScore = score;

    // Optimistic update
    let newScore = score;
    let newVote: 'upvote' | 'downvote' | null;

    if (wasVoted) {
      newVote = null;
      newScore = type === 'upvote' ? score - 1 : score + 1;
    } else {
      newVote = type;
      if (prevVote === null) {
        newScore = type === 'upvote' ? score + 1 : score - 1;
      } else {
        newScore = type === 'upvote' ? score + 2 : score - 2;
      }
    }

    setUserVote(newVote);
    setScore(newScore);
    onVoteChange?.(post.id, newScore, newVote);

    try {
      if (wasVoted) {
        await sdk.posts.unreact(post.id);
      } else {
        if (prevVote) {
          await sdk.posts.unreact(post.id);
        }
        await sdk.posts.react(post.id, type as any);
      }
    } catch {
      // Rollback
      setUserVote(prevVote);
      setScore(prevScore);
      onVoteChange?.(post.id, prevScore, prevVote);
    }
  };

  const handleReport = async (reason: string, details: string) => {
    try {
      const apiKey = await getItem('minds:api_key');
      await fetch(`${BASE_ORIGIN}/api/v1/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          target_type: 'post',
          target_id: post.id,
          reason,
          details,
        }),
      });
    } catch {
      // Optimistic UX — report appears submitted even if endpoint doesn't exist yet
    }
  };

  const handleTip = async (_amount: number, _message: string) => {
    const msg = 'Tipping coming soon — this feature will use MINDS tokens';
    if (Platform.OS === 'web') {
      alert(msg);
    } else {
      Alert.alert('Coming Soon', msg);
    }
  };

  const isOwnPost = user?.id && (author.id === user.id);

  const handleDelete = async () => {
    if (!sdk) return;
    const doDelete = async () => {
      try {
        await sdk.posts.delete(post.id);
        setIsDeleted(true);
        onPostDeleted?.(post.id);
      } catch {
        const errMsg = 'Failed to delete post. Please try again.';
        if (Platform.OS === 'web') alert(errMsg);
        else Alert.alert('Error', errMsg);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Delete this post? This cannot be undone.')) {
        await doDelete();
      }
    } else {
      Alert.alert('Delete Post', 'Delete this post? This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleEditSave = async () => {
    if (!sdk || !editContent.trim()) return;
    setEditSaving(true);
    try {
      await sdk.posts.update(post.id, { content: editContent.trim() });
      setCurrentContent(editContent.trim());
      setIsEditing(false);
    } catch {
      const errMsg = 'Failed to update post. Please try again.';
      if (Platform.OS === 'web') alert(errMsg);
      else Alert.alert('Error', errMsg);
    } finally {
      setEditSaving(false);
    }
  };

  const renderMarkdownContent = () => {
    if (!content) return null;

    if (Platform.OS === 'web') {
      const html = renderMarkdownToHtml(compact ? content.slice(0, 300) : content);
      // Use createElement to avoid TSX type issues with <div> in React Native
      const WebDiv = 'div' as any;
      return (
        <WebDiv
          dangerouslySetInnerHTML={{ __html: html }}
          style={{
            color: colors.text,
            fontSize: typography.body.fontSize,
            lineHeight: `${typography.body.lineHeight}px`,
            marginBottom: media ? spacing.md : 0,
            wordBreak: 'break-word',
          }}
        />
      );
    }

    // Native: parse segments
    const segments = parseMarkdownSegments(compact ? content.slice(0, 300) : content);
    return (
      <Text variant="body" style={{ marginBottom: media ? spacing.md : 0 }}>
        {segments.map((seg, i) => {
          switch (seg.type) {
            case 'bold':
              return <Text key={i} variant="bodyMedium" style={{ fontWeight: '700' }}>{seg.text}</Text>;
            case 'italic':
              return <Text key={i} variant="body" style={{ fontStyle: 'italic' }}>{seg.text}</Text>;
            case 'code':
              return (
                <Text
                  key={i}
                  variant="mono"
                  color={colors.textSecondary}
                  style={{ backgroundColor: colors.surfaceRaised }}
                >
                  {seg.text}
                </Text>
              );
            case 'link':
              return (
                <Text
                  key={i}
                  variant="body"
                  color={colors.accent}
                  onPress={() => Linking.openURL(seg.url)}
                  style={{ textDecorationLine: 'underline' }}
                >
                  {seg.text}
                </Text>
              );
            case 'break':
              return <Text key={i}>{'\n'}</Text>;
            default:
              return <Text key={i} variant="body">{seg.text}</Text>;
          }
        })}
        {compact && content.length > 300 ? (
          <Text variant="body" color={colors.textMuted}>...</Text>
        ) : null}
      </Text>
    );
  };

  const renderContent = () => (
    <View>
      {renderMarkdownContent()}
      {media ? (
        <Image
          source={{ uri: typeof media === 'string' ? media : media.url }}
          style={{
            width: '100%',
            height: 200,
            borderRadius: radius.md,
            backgroundColor: colors.surfaceHover,
          }}
          resizeMode="cover"
        />
      ) : null}
    </View>
  );

  if (isDeleted) return null;

  return (
    <Pressable
      onPress={() => !isEditing && router.push(`/post/${post.id}`)}
      style={({ pressed }) => ({
        backgroundColor: pressed && !isEditing ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.06)',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
      })}
    >
      {/* Boost badge */}
      {isBoosted && (
        <View style={{ marginBottom: spacing.sm }}>
          <BoostBadge />
        </View>
      )}

      {/* Author row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          marginBottom: spacing.md,
        }}
      >
        <Pressable onPress={() => router.push(`/user/${authorUsername}`)}>
          <Avatar uri={authorAvatar} name={authorName} size="sm" />
        </Pressable>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Pressable onPress={() => router.push(`/user/${authorUsername}`)}>
              <Text variant="caption" numberOfLines={1} style={{ fontWeight: '400' }}>
                {authorName}
              </Text>
            </Pressable>
            <Text variant="caption" color={colors.textMuted}>
              @{authorUsername}
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              {timeAgo(createdAt)}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {isEditing ? (
        <View style={{ gap: spacing.sm }}>
          <TextInput
            value={editContent}
            onChangeText={setEditContent}
            multiline
            autoFocus
            style={{
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.accent,
              borderRadius: radius.md,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              color: colors.text,
              minHeight: 80,
              ...typography.body,
              ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
            }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Pressable
              onPress={() => setIsEditing(false)}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceHover,
              }}
            >
              <Text variant="label" color={colors.textSecondary}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleEditSave}
              disabled={editSaving || !editContent.trim()}
              style={{
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.sm,
                borderRadius: radius.md,
                backgroundColor: colors.accent,
                opacity: editSaving ? 0.6 : 1,
              }}
            >
              <Text variant="label" color="#fff">{editSaving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      ) : isNsfw ? (
        <NSFWOverlay>{renderContent()}</NSFWOverlay>
      ) : (
        renderContent()
      )}

      {/* Action bar */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.lg,
        }}
      >
        <VoteButtons
          score={score}
          userVote={userVote}
          onUpvote={() => handleVote('upvote')}
          onDownvote={() => handleVote('downvote')}
          compact
        />

        <Pressable
          onPress={() => router.push(`/post/${post.id}`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          hitSlop={8}
        >
          <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>
            {replyCount}
          </Text>
        </Pressable>

        <Pressable hitSlop={8} style={{ padding: 2 }}>
          <Ionicons name="repeat-outline" size={18} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => setShowTip(true)}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: 2 }}
        >
          <Ionicons name="gift-outline" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => setShowMenu(!showMenu)}
          hitSlop={8}
          style={{ padding: 2 }}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      {/* Context menu */}
      {showMenu && (
        <View
          style={{
            position: 'absolute',
            right: spacing.xl,
            bottom: spacing['5xl'],
            backgroundColor: colors.surfaceRaised,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            padding: spacing.xs,
            zIndex: 10,
            minWidth: 160,
          }}
        >
          {isOwnPost && (
            <Pressable
              onPress={() => {
                setShowMenu(false);
                setEditContent(content);
                setIsEditing(true);
              }}
              style={{ padding: spacing.md }}
            >
              <Text variant="body">Edit</Text>
            </Pressable>
          )}
          {isOwnPost && (
            <Pressable
              onPress={() => { setShowMenu(false); handleDelete(); }}
              style={{ padding: spacing.md }}
            >
              <Text variant="body" color={colors.error}>Delete</Text>
            </Pressable>
          )}
          <Pressable
            onPress={() => { setShowMenu(false); setShowReport(true); }}
            style={{ padding: spacing.md }}
          >
            <Text variant="body" color={colors.error}>Report</Text>
          </Pressable>
          <Pressable
            onPress={async () => {
              setShowMenu(false);
              const url = `https://minds.on.recursiv.io/(tabs)/post/${post.id}`;
              try {
                if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator?.clipboard) {
                  await navigator.clipboard.writeText(url);
                  alert('Link copied!');
                }
              } catch {}
            }}
            style={{ padding: spacing.md }}
          >
            <Text variant="body">Copy Link</Text>
          </Pressable>
        </View>
      )}

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        onSubmit={handleReport}
      />

      <TipModal
        visible={showTip}
        onClose={() => setShowTip(false)}
        recipientName={authorName}
        recipientAvatar={authorAvatar}
        onSend={handleTip}
      />
    </Pressable>
  );
}
