import * as React from 'react';
import { View, Pressable, Image, Platform, Linking, TextInput, Alert, Modal, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { VoteButtons } from './VoteButtons';
import { NSFWOverlay } from './NSFWOverlay';
import { ReportModal } from './ReportModal';
import { useAuth } from '../lib/auth';
import { BASE_ORIGIN, ORG_ID } from '../lib/recursiv';
import { getItem } from '../lib/storage';
import { useToast } from './Toast';
import { isBookmarked, toggleBookmark } from '../lib/bookmarks';
import { isMuted, toggleMute } from '../lib/muted';
import { getCached } from '../lib/cache';
import { LinkPreview } from './LinkPreview';
import { MediaViewer } from './MediaViewer';
import { Badge, getBadges } from './Badge';
import { colors, spacing, radius, typography } from '../constants/theme';
import { renderMarkdownToHtml, parseMarkdownSegments } from '../lib/markdown';

interface Props {
  post: any;
  canModerate?: boolean;
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

export const PostCard = React.memo(function PostCard({ post, onVoteChange, onPostDeleted, compact = false, canModerate = false }: Props) {
  const router = useRouter();
  const { sdk, user } = useAuth();
  const toast = useToast();
  const [userVote, setUserVote] = React.useState<'upvote' | 'downvote' | null>(
    post.userReaction || post.user_reaction || post.userVote || post.user_vote || null
  );
  const [score, setScore] = React.useState(post.score ?? post.vote_count ?? post.voteCount ?? 0);
  const [showMenu, setShowMenu] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ x: number; y: number } | null>(null);
  const [showReport, setShowReport] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(post.content || post.body || '');
  const [editSaving, setEditSaving] = React.useState(false);
  const [currentContent, setCurrentContent] = React.useState(post.content || post.body || '');
  const [isDeleted, setIsDeleted] = React.useState(false);
  const [saved, setSaved] = React.useState(isBookmarked(post.id));

  // Sync ALL state when post prop changes (prevents content mixing between posts)
  React.useEffect(() => {
    setCurrentContent(post.content || post.body || '');
    setEditContent(post.content || post.body || '');
    setIsEditing(false);
    setShowMenu(false);
    setIsDeleted(false);
  }, [post.id]);

  // Sync vote state from server data — runs when post data updates (not just post.id)
  React.useEffect(() => {
    const serverVote = post.userReaction || post.user_reaction || post.userVote || post.user_vote || null;
    const serverScore = post.score ?? post.vote_count ?? post.voteCount ?? 0;
    setUserVote(serverVote);
    setScore(serverScore);
  }, [post.id, post.userReaction, post.user_reaction, post.score]);

  const author = post.author || post.user || {};
  const authorName = author.name || author.username || 'Anonymous';
  const authorUsername = author.username || author.id || 'anonymous';
  const authorAvatar = author.image || author.avatar || null;
  const content = currentContent || '';
  const rawMedia = post.media;
  const media = (Array.isArray(rawMedia) ? rawMedia[0]?.url : rawMedia) || post.image || post.thumbnail || null;
  const replyCount = post.replyCount || post.reply_count || post.comments_count || 0;
  const isNsfw = (post.tags || []).some((t: any) =>
    typeof t === 'string' ? t.toLowerCase() === 'nsfw' : t?.name?.toLowerCase() === 'nsfw'
  );
  const createdAt = post.createdAt || post.created_at || new Date().toISOString();
  const isOwnPost = user?.id && (author.id === user.id);
  const communityId = post.communityId || post.community_id;
  const communityName = React.useMemo(() => {
    if (!communityId) return null;
    const communities = getCached('communities:30') || getCached('communities:50') || getCached('communities:10') || getCached('communities:100') || [];
    const match = communities.find((c: any) => c.id === communityId);
    return match?.name || null;
  }, [communityId]);

  const handleVote = async (type: 'upvote' | 'downvote') => {
    if (!sdk) return;
    const wasVoted = userVote === type;
    const prevVote = userVote;
    const prevScore = score;

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
        if (prevVote) await sdk.posts.unreact(post.id);
        await sdk.posts.react(post.id, type as any);
      }
      // Update cache so other views of this post show correct vote
      try {
        const { setCache, getCached } = require('../lib/cache');
        const cached = getCached(`post:${post.id}`);
        if (cached) {
          setCache(`post:${post.id}`, { ...cached, score: newScore, userReaction: newVote, user_reaction: newVote });
        }
      } catch {}
    } catch (err: any) {
      toast.show('Vote failed', 'error');
      setUserVote(prevVote);
      setScore(prevScore);
      onVoteChange?.(post.id, prevScore, prevVote);
    }
  };

  const handleReport = async (reason: string, details: string) => {
    try {
      const apiKey = await getItem('minds:api_key');
      const res = await fetch(`${BASE_ORIGIN}/api/v1/reports`, {
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
      if (!res.ok) {
        toast.show('Report failed', 'error');
        return;
      }
      toast.show('Report submitted');
    } catch {
      toast.show('Report failed', 'error');
    }
  };

  const handleDelete = async () => {
    if (!sdk) return;
    const doDelete = async () => {
      try {
        await sdk.posts.delete(post.id);
        setIsDeleted(true);
        onPostDeleted?.(post.id);
      } catch {
        Alert.alert('Error', 'Failed to delete post.');
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Delete this post?')) await doDelete();
    } else {
      Alert.alert('Delete Post', 'Delete this post?', [
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
      Alert.alert('Error', 'Failed to update post.');
    } finally {
      setEditSaving(false);
    }
  };

  const renderMarkdownContent = () => {
    if (!content) return null;

    if (Platform.OS === 'web') {
      const html = renderMarkdownToHtml(compact ? content.slice(0, 300) : content);
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
                <Text key={i} variant="mono" color={colors.textSecondary} style={{ backgroundColor: colors.surfaceRaised }}>
                  {seg.text}
                </Text>
              );
            case 'hashtag':
              return (
                <Text
                  key={i}
                  variant="body"
                  color={colors.accent}
                  onPress={(e: any) => {
                    // Prevent click from bubbling up to the outer post Pressable
                    // and navigating away from the hashtag filter.
                    e?.stopPropagation?.();
                    router.push({ pathname: '/(tabs)/discover', params: { tab: 'posts', q: `#${(seg as any).tag}` } } as any);
                  }}
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
                  onPress={(e: any) => {
                    e?.stopPropagation?.();
                    Linking.openURL(seg.url);
                  }}
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

  if (isDeleted) return null;

  return (
    <Pressable
      // Guard against click-through when the overflow menu is open. On web,
      // clicks on menu items (mute / report / share) bubble up through
      // nested Pressables and would otherwise trigger post navigation.
      onPress={() => !isEditing && !showMenu && router.push(`/(tabs)/post/${post.id}` as any)}
      style={({ pressed, hovered }: any) => ({
        backgroundColor: pressed && !isEditing && !showMenu ? colors.surfaceHover : (hovered && !isEditing && !showMenu) ? 'rgba(255,255,255,0.03)' : 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
        paddingHorizontal: spacing.xl,
        paddingTop: spacing.lg,
        paddingBottom: spacing.xl,
        ...(Platform.OS === 'web' ? { transition: 'background-color 0.15s ease', cursor: isEditing ? 'default' : 'pointer' } as any : {}),
      })}
    >
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {/* Avatar column */}
      <Pressable onPress={() => router.push(`/(tabs)/user/${authorUsername}` as any)} style={{ paddingTop: 2 }}>
        <Avatar uri={authorAvatar} name={authorName} size="sm" />
      </Pressable>

      {/* Content column */}
      <View style={{ flex: 1 }}>
      {/* Author name + badges + time + community */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' }}>
        <Pressable onPress={() => router.push(`/(tabs)/user/${authorUsername}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="label">{authorName}</Text>
          {getBadges(author).map(b => <Badge key={b} type={b} size="sm" />)}
        </Pressable>
        {communityName && (
          <>
            <Text variant="caption" color={colors.textMuted}>in</Text>
            <Pressable onPress={() => router.push(`/(tabs)/community/${communityId}` as any)}>
              <Text variant="label" color={colors.accent}>{communityName}</Text>
            </Pressable>
          </>
        )}
        <Text variant="caption" color={colors.textMuted}>{timeAgo(createdAt)}</Text>
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
              style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceHover }}
            >
              <Text variant="label" color={colors.textSecondary}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleEditSave}
              disabled={editSaving || !editContent.trim()}
              style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.accent, opacity: editSaving ? 0.6 : 1 }}
            >
              <Text variant="label" color="#fff">{editSaving ? 'Saving...' : 'Save'}</Text>
            </Pressable>
          </View>
        </View>
      ) : isNsfw ? (
        <NSFWOverlay>
          <View>
            {renderMarkdownContent()}
            <MediaViewer media={post.media} thumbnail={post.image || post.thumbnail} />
          </View>
        </NSFWOverlay>
      ) : (
        <View>
          {renderMarkdownContent()}
          <MediaViewer media={post.media} thumbnail={post.image || post.thumbnail} />
          <LinkPreview content={content} />
        </View>
      )}

      {/* Tags */}
      {post.tags && post.tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm }}>
          {post.tags.slice(0, 5).map((tag: any) => {
            const tagName = typeof tag === 'string' ? tag : tag.name || tag.slug;
            if (!tagName) return null;
            return (
              <Pressable
                key={tagName}
                onPress={() => router.push({ pathname: '/(tabs)/discover', params: { tab: 'posts', q: tagName } } as any)}
                style={{
                  paddingHorizontal: spacing.sm + 2,
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: colors.surface,
                  borderWidth: 0.5,
                  borderColor: colors.glassBorder,
                }}
              >
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>#{tagName}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Action bar: vote, comment, more */}
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
          onPress={() => router.push(`/(tabs)/post/${post.id}` as any)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
          hitSlop={8}
        >
          <Ionicons name="chatbubble-outline" size={16} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>{replyCount}</Text>
        </Pressable>

        <Pressable
          onPress={(e: any) => {
            e?.stopPropagation?.();
            // Minds-style "remind" — silently promote the post to your feed.
            // No quote prompt, no "Reposted from" prefix, no emoji injection.
            // Content is duplicated as-is so the remind renders as a clean
            // post in the reposter's feed.
            if (!sdk) return;
            sdk.posts.create({
              content,
              organization_id: ORG_ID || undefined,
              community_id: post.communityId || post.community_id || undefined,
            } as any)
              .then(() => toast.show('Reposted', 'success'))
              .catch(() => toast.show('Repost failed', 'error'));
          }}
          hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: 2 }}
        >
          <Ionicons name="repeat-outline" size={16} color={colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => {
            const nowSaved = toggleBookmark(post.id);
            setSaved(nowSaved);
            toast.show(nowSaved ? 'Saved' : 'Removed from saved');
          }}
          hitSlop={8}
          style={{ padding: 2 }}
        >
          <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={16} color={saved ? colors.accent : colors.textMuted} />
        </Pressable>

        <Pressable
          onPress={(e: any) => {
            e?.stopPropagation?.();
            // Capture the page-relative position of the ellipsis so the menu
            // can render right next to it no matter where in the feed the
            // user clicked. React Native Web gives us nativeEvent.pageX/pageY;
            // native gives us pageX/pageY too.
            const pageX = e?.nativeEvent?.pageX ?? 0;
            const pageY = e?.nativeEvent?.pageY ?? 0;
            setMenuPos({ x: pageX, y: pageY });
            setShowMenu(true);
          }}
          hitSlop={8}
          style={{ padding: 2 }}
        >
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textMuted} />
        </Pressable>
      </View>
      {/* End content column */}
      </View>
      {/* End avatar + content row */}
      </View>

      {/* Context menu — rendered in a React Native Modal so it always sits on
          top of the feed (link previews, media, etc.) and pops up right next
          to the ellipsis regardless of scroll position. */}
      <Modal
        visible={showMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable
          onPress={() => setShowMenu(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' }}
        >
          {(() => {
            const MENU_WIDTH = 180;
            const MENU_HEIGHT_EST = 220;
            const screen = Dimensions.get('window');
            const x = Math.min(Math.max(8, (menuPos?.x ?? 16) - MENU_WIDTH + 24), screen.width - MENU_WIDTH - 8);
            const y = Math.min(Math.max(8, (menuPos?.y ?? 16) + 8), screen.height - MENU_HEIGHT_EST - 8);
            return (
              <View
                style={{
                  position: 'absolute',
                  top: y,
                  left: x,
                  width: MENU_WIDTH,
                  backgroundColor: colors.surfaceRaised,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                  padding: spacing.xs,
                  ...(Platform.OS === 'web' ? { boxShadow: '0 12px 48px rgba(0,0,0,0.9)' } as any : { elevation: 12 }),
                }}
              >
                {isOwnPost && (
                  <Pressable onPress={() => { setShowMenu(false); setEditContent(content); setIsEditing(true); }} style={{ padding: spacing.md }}>
                    <Text variant="body">Edit</Text>
                  </Pressable>
                )}
                {(isOwnPost || canModerate) && (
                  <Pressable onPress={() => { setShowMenu(false); handleDelete(); }} style={{ padding: spacing.md }}>
                    <Text variant="body" color={colors.error}>Delete</Text>
                  </Pressable>
                )}
                {!isOwnPost && (
                  <Pressable
                    onPress={() => {
                      setShowMenu(false);
                      const authorId = author.id;
                      if (authorId) {
                        const muted = toggleMute(authorId);
                        toast.show(muted ? `Muted ${authorName}` : `Unmuted ${authorName}`);
                      }
                    }}
                    style={{ padding: spacing.md }}
                  >
                    <Text variant="body">{isMuted(author.id) ? 'Unmute' : 'Mute'}</Text>
                  </Pressable>
                )}
                <Pressable onPress={() => { setShowMenu(false); setShowReport(true); }} style={{ padding: spacing.md }}>
                  <Text variant="body" color={colors.error}>Report</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    setShowMenu(false);
                    const url = `${BASE_ORIGIN}/post/${post.id}`;
                    try {
                      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
                        if (navigator.share) {
                          await navigator.share({ title: post.title || 'Post on Minds', url });
                        } else if (navigator.clipboard) {
                          await navigator.clipboard.writeText(url);
                          toast.show('Link copied');
                        }
                      } else {
                        const { Share } = require('react-native');
                        await Share.share({ message: url });
                      }
                    } catch {}
                  }}
                  style={{ padding: spacing.md }}
                >
                  <Text variant="body">Share</Text>
                </Pressable>
              </View>
            );
          })()}
        </Pressable>
      </Modal>

      <ReportModal
        visible={showReport}
        onClose={() => setShowReport(false)}
        onSubmit={handleReport}
      />
    </Pressable>
  );
});
