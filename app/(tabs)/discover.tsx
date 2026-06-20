import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable, ActivityIndicator, ScrollView, Image, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Button, Skeleton, PostCard } from '../../components';
import { Container } from '../../components/Container';
import { TabBar } from '../../components/TabBar';
import { usePosts, useCommunities, useAgents, useProfiles, useSearchPosts } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { logSignal } from '../../lib/signals';
import { ORG_ID } from '../../lib/recursiv';
import { spacing, radius, typography, shadows } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { profileFollowerCount, profilePostCount, postScore, postReplyCount, timestampOf } from '../../lib/models';

// ──────────────────────────────────────────────────────────────────────────
// Discover — the front door of Minds.
//
// Goal: intuitive + compelling. A search-forward top, a live trending-topics
// rail, then a stack of CURATED sections that mine the now-rich network:
//   1. Hot right now      — top posts by real vote score (featured + carousel)
//   2. Voices to follow   — creators ranked by followers
//   3. Communities        — ranked by members + activity
//   4. Talk to an agent    — discoverable AI agents
//   5. Rediscover          — buried gems: high engagement, older posts
//
// All ranking is a CLIENT-SIDE SORT over data the existing hooks already load
// (usePosts('score'), useProfiles, useCommunities, useAgents). No SDK changes.
// Every value comes from the shared model accessors so field-name drift can't
// silently break a sort. See the rationale at the bottom of the PR for which
// rankings would benefit from a dedicated server endpoint.
// ──────────────────────────────────────────────────────────────────────────

// ── Layout profile, resolved from the MEASURED content width (Discover renders
// beside the sidebar on web, so sizing off the window overshoots). One rich
// column on phones, wider carousels and a 2-up hero on tablet/desktop.
type Layout = {
  width: number;
  isWide: boolean;
  isUltra: boolean;
  gutter: number;
};

function computeLayout(width: number): Layout {
  const w = width || 360;
  const isWide = w >= 700;
  const isUltra = w >= 1040;
  const gutter = isWide ? spacing['2xl'] : spacing.lg;
  return { width: w, isWide, isUltra, gutter };
}

// Cross-platform cover image (RN <Image> covers web + native; the old raw <img>
// hero painted nothing on native).
function CoverImage({ uri, height, radius: r = 0 }: { uri: string; height: number; radius?: number }) {
  const colors = useColors();
  return (
    <Image
      source={{ uri }}
      resizeMode="cover"
      style={{ width: '100%', height, borderRadius: r, backgroundColor: colors.surfaceRaised }}
    />
  );
}

function formatCount(n: number): string {
  if (!n || n < 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

function timeAgoShort(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo`;
  return `${Math.floor(diff / 31536000)}y`;
}

// ── Trending topics, derived live from the loaded posts ──
type TrendingTopic = { tag: string; count: number };

function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /#([\p{L}\p{N}_]{2,30})/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1].toLowerCase());
  return out;
}

function computeTrendingTopics(posts: any[], limit = 12): TrendingTopic[] {
  const counts = new Map<string, { display: string; count: number }>();
  for (const p of posts || []) {
    const tags: string[] = [];
    if (Array.isArray(p?.tags)) {
      for (const t of p.tags) {
        const clean = String(t).replace(/^#/, '').trim();
        if (clean.length >= 2) tags.push(clean);
      }
    }
    tags.push(...extractHashtags(p?.content));
    tags.push(...extractHashtags(p?.title));
    const seen = new Set<string>();
    for (const raw of tags) {
      const key = raw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { display: raw, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((t) => ({ tag: t.display, count: t.count }));
}

function getDomain(url: string | null | undefined): string {
  if (!url) return '';
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : null;
}
function postSource(post: any): string {
  if (post.source_name) return String(post.source_name);
  if (post.sourceName) return String(post.sourceName);
  const url = post.external_url || post.externalUrl || extractUrl(post.content);
  return getDomain(url) || 'Minds';
}
function postAuthorName(post: any): string {
  return post.author?.name || post.author?.username || postSource(post);
}
function postTitle(post: any): string {
  return (post.title || post.content || '').trim();
}

// Best still for a post thumbnail. Flags video so we can badge it.
function postThumb(post: any): { url: string | null; hasVideo: boolean } {
  const raw = post.media;
  const arr = Array.isArray(raw) ? raw : raw ? [raw] : [];
  let imgUrl: string | null = null;
  let hasVideo = false;
  for (const m of arr) {
    const url = typeof m === 'string' ? m : m?.url;
    const type = typeof m === 'string' ? '' : (m?.type || '');
    if (!url) continue;
    if (type.startsWith('video') || /\.m3u8|\/video\//i.test(url)) hasVideo = true;
    else if (!imgUrl) imgUrl = url;
  }
  return { url: imgUrl || post.image || post.previewImage || post.thumbnail || null, hasVideo };
}

// ── Engagement score for ranking. Real vote score is the spine; replies add a
// conversation bonus; media gives a small visual-appeal nudge so the page leads
// with content that actually pulls you in. Pure client sort over loaded posts.
function engagementScore(post: any): number {
  const votes = postScore(post);
  const replies = postReplyCount(post);
  const hasMedia = postThumb(post).url || postThumb(post).hasVideo ? 1 : 0;
  return votes + replies * 2 + hasMedia * 4;
}

// ── A "gem score" for Rediscover: posts that earned real engagement but aren't
// fresh, so great older content resurfaces instead of decaying into the
// archive. We reward score+replies and gate to anything older than ~3 days.
function isRediscoverable(post: any): boolean {
  const ts = timestampOf(post);
  if (!ts) return false;
  const ageDays = (Date.now() - new Date(ts).getTime()) / 86_400_000;
  return ageDays >= 3 && (postScore(post) + postReplyCount(post)) >= 2;
}

// ──────────────────────────────────────────────────────────────────────────
// Section scaffolding
// ──────────────────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, icon, onSeeAll, gutter }: {
  title: string; subtitle?: string; icon?: keyof typeof Ionicons.glyphMap; onSeeAll?: () => void; gutter: number;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: gutter,
        paddingTop: spacing['2xl'],
        paddingBottom: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {/* Gold tick — a small accent bar that gives every module a masthead feel. */}
          <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.accent }} />
          {icon ? <Ionicons name={icon} size={16} color={colors.accent} /> : null}
          <Text variant="h2">{title}</Text>
        </View>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2, marginLeft: spacing.sm + 4 }}>{subtitle}</Text>
        ) : null}
      </View>
      {onSeeAll ? (
        <Pressable
          onPress={onSeeAll}
          hitSlop={8}
          style={Platform.OS === 'web' ? ({ cursor: 'pointer', flexDirection: 'row', alignItems: 'center', gap: 4 } as any) : { flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Text variant="caption" color={colors.accent}>See all</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function HorizontalRail({ children, gutter, snap }: { children: React.ReactNode; gutter: number; snap?: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={snap}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.xs, gap: spacing.md }}
    >
      {children}
    </ScrollView>
  );
}

function RailSkeleton({ gutter, width, height }: { gutter: number; width: number; height: number }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.md }}
    >
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} width={width} height={height} borderRadius={radius.lg} />
      ))}
    </ScrollView>
  );
}

// ── Live trending-topics rail. Each chip is a real hashtag counted from the
// loaded posts; tapping it routes into the existing search path. ──
function TrendingTopicsRow({ topics, onPick, gutter }: { topics: TrendingTopic[]; onPick: (tag: string) => void; gutter: number }) {
  const colors = useColors();
  if (!topics.length) return null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: gutter, paddingTop: spacing.lg, paddingBottom: spacing.xs }}>
        <Ionicons name="flame" size={13} color={colors.accent} />
        <Text variant="caption" color={colors.textMuted} style={{ letterSpacing: 1.2, fontSize: 10 }}>TRENDING NOW</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: spacing.sm, gap: spacing.sm }}>
        {topics.map((t) => (
          <Pressable
            key={t.tag}
            onPress={() => onPick(t.tag)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: colors.borderSubtle,
              backgroundColor: pressed ? colors.accentMuted : colors.surface,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Text variant="caption" color={colors.accent} style={{ fontSize: 12 }}>#</Text>
            <Text variant="caption" color={colors.text} style={{ fontSize: 12 }}>{t.tag}</Text>
            {t.count > 1 ? <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t.count}</Text> : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Hot — featured hero + carousel
// ──────────────────────────────────────────────────────────────────────────

// Big editorial lead card for the #1 hot post. Immersive cover with a scrim
// when there's art; a typographic card with a gold rule when there isn't.
const FeaturedPost = React.memo(function FeaturedPost({ post, onPress, layout }: { post: any; onPress: () => void; layout: Layout }) {
  const colors = useColors();
  const { url, hasVideo } = postThumb(post);
  const title = postTitle(post);
  const score = postScore(post);
  const replies = postReplyCount(post);
  const author = postAuthorName(post);
  const coverHeight = layout.isUltra ? 360 : layout.isWide ? 300 : 220;
  React.useEffect(() => { if (post?.id) logSignal('view', { postId: post.id, metadata: { surface: 'discover_featured' } }); }, [post?.id]);

  const stat = (icon: keyof typeof Ionicons.glyphMap, value: string, onImage: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Ionicons name={icon} size={13} color={onImage ? '#fff' : colors.accent} />
      <Text variant="caption" color={onImage ? 'rgba(255,255,255,0.9)' : colors.textSecondary}>{value}</Text>
    </View>
  );

  const eyebrow = (onImage: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm }}>
      <Ionicons name="flame" size={11} color={colors.textOnAccent} />
      <Text variant="label" color={colors.textOnAccent} style={{ fontSize: 10, letterSpacing: 1 }}>#1 HOT</Text>
    </View>
  );

  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_featured' } }); onPress(); }}
      style={({ pressed }) => ({
        borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: url ? 0 : 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.97 : 1,
        ...shadows.md(colors.shadow),
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      })}
    >
      {url ? (
        <View style={{ position: 'relative' }}>
          <CoverImage uri={url} height={coverHeight} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: '30%', backgroundColor: 'rgba(0,0,0,0.55)' }} />
          {hasVideo ? (
            <View style={{ position: 'absolute', top: spacing.md, right: spacing.md, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={15} color="#fff" style={{ marginLeft: 2 }} />
            </View>
          ) : null}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: layout.isWide ? spacing.xl : spacing.lg, gap: spacing.sm }}>
            {eyebrow(true)}
            <Text variant={layout.isWide ? 'h1' : 'h2'} color="#fff" numberOfLines={3} style={{ maxWidth: 720 }}>{title || 'Untitled'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: 2 }}>
              <Text variant="caption" color="rgba(255,255,255,0.82)" numberOfLines={1} style={{ maxWidth: 200 }}>{author}</Text>
              {score > 0 ? stat('arrow-up', String(score), true) : null}
              {replies > 0 ? stat('chatbubble-outline', String(replies), true) : null}
            </View>
          </View>
        </View>
      ) : (
        <View style={{ padding: layout.isWide ? spacing['2xl'] : spacing.xl, gap: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.accent }}>
          {eyebrow(false)}
          <Text variant={layout.isWide ? 'h1' : 'h2'} color={colors.text} numberOfLines={4}>{title || 'Untitled'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: 2 }}>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ maxWidth: 200 }}>{author}</Text>
            {score > 0 ? stat('arrow-up', String(score), false) : null}
            {replies > 0 ? stat('chatbubble-outline', String(replies), false) : null}
          </View>
        </View>
      )}
    </Pressable>
  );
});

const POST_TILE_W = 260;

// Compact content card for the Hot carousel: media thumb, headline, author +
// real engagement (votes + replies).
const PostTile = React.memo(function PostTile({ post, onPress, width }: { post: any; onPress: () => void; width: number }) {
  const colors = useColors();
  const { url, hasVideo } = postThumb(post);
  const title = postTitle(post);
  const score = postScore(post);
  const replies = postReplyCount(post);
  const author = postAuthorName(post);
  const hasMedia = !!url || hasVideo;
  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_hot' } }); onPress(); }}
      style={({ hovered }: any) => ({
        width,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      {url ? (
        <View style={{ height: 130, position: 'relative' }}>
          <CoverImage uri={url} height={130} />
          {hasVideo ? (
            <View style={{ position: 'absolute', bottom: spacing.xs, right: spacing.xs, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="play" size={12} color="#fff" style={{ marginLeft: 1 }} />
            </View>
          ) : null}
        </View>
      ) : hasVideo ? (
        <View style={{ height: 130, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="play-circle" size={34} color={colors.accent} />
        </View>
      ) : null}
      <View style={{ padding: spacing.md, gap: spacing.xs, flex: 1 }}>
        <Text variant="bodyMedium" numberOfLines={hasMedia ? 2 : 4} style={{ lineHeight: 20, minHeight: hasMedia ? 40 : undefined }}>{title || 'Untitled'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 'auto' as any }}>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>{author}</Text>
          {score > 0 ? <Text variant="caption" color={colors.accent}>↑ {score}</Text> : null}
          {replies > 0 ? <Text variant="caption" color={colors.textMuted}>· {replies}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
});

// ── Rediscover card — wider, "from the archive" framing with the post's age so
// it reads as resurfaced rather than new. ──
const REDISCOVER_TILE_W = 300;
const RediscoverTile = React.memo(function RediscoverTile({ post, onPress, width }: { post: any; onPress: () => void; width: number }) {
  const colors = useColors();
  const { url } = postThumb(post);
  const title = postTitle(post);
  const score = postScore(post);
  const replies = postReplyCount(post);
  const author = postAuthorName(post);
  const age = timeAgoShort(timestampOf(post));
  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_rediscover' } }); onPress(); }}
      style={({ hovered }: any) => ({
        width,
        flexDirection: 'row',
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      {url ? (
        <View style={{ width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden' }}>
          <CoverImage uri={url} height={72} />
        </View>
      ) : (
        <View style={{ width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="bookmark" size={22} color={colors.accent} />
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Text variant="bodyMedium" numberOfLines={2} style={{ lineHeight: 19 }}>{title || 'Untitled'}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={{ flex: 1 }}>{author}</Text>
          {age ? <Text variant="caption" color={colors.textMuted}>{age} ago</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          {score > 0 ? <Text variant="caption" color={colors.accent}>↑ {score}</Text> : null}
          {replies > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Ionicons name="chatbubble-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{replies}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

// ──────────────────────────────────────────────────────────────────────────
// Entity tiles (people / communities / agents)
// ──────────────────────────────────────────────────────────────────────────

const ENTITY_TILE_W = 220;

function FollowPill({ initialActive, onToggle }: { initialActive?: boolean; onToggle: (next: boolean) => void }) {
  const colors = useColors();
  const [active, setActive] = React.useState(!!initialActive);
  return (
    <Pressable
      onPress={(e: any) => { e?.stopPropagation?.(); const next = !active; setActive(next); onToggle(next); }}
      hitSlop={6}
      style={{
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        alignItems: 'center',
        backgroundColor: active ? 'transparent' : colors.accent,
        borderWidth: active ? 1 : 0,
        borderColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
      }}
    >
      <Text variant="caption" color={active ? colors.text : colors.textOnAccent} style={{ fontFamily: 'Roboto-Medium' }}>
        {active ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

const PersonTile = React.memo(function PersonTile({ person, onPress, onFollow, isFollowed, width }: {
  person: any; onPress: () => void; onFollow: () => void; isFollowed?: boolean; width: number;
}) {
  const colors = useColors();
  const name = person.name || person.username || 'Someone';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  const followers = profileFollowerCount(person);
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => ({
        width,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        gap: spacing.sm,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      <View style={{ alignItems: 'center', gap: spacing.xs }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <Text variant="bodyMedium" numberOfLines={1} align="center" style={{ marginTop: spacing.xs }}>{name}</Text>
        {username ? <Text variant="caption" color={colors.textMuted} numberOfLines={1}>@{username}</Text> : null}
      </View>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} align="center" style={{ lineHeight: 17, minHeight: 34 }}>{bio}</Text>
      ) : <View style={{ minHeight: 34 }} />}
      {followers > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <Ionicons name="people-outline" size={12} color={colors.textMuted} />
          <Text variant="caption" color={colors.textMuted}>{formatCount(followers)} followers</Text>
        </View>
      ) : null}
      <FollowPill initialActive={isFollowed} onToggle={() => onFollow()} />
    </Pressable>
  );
});

const CommunityTile = React.memo(function CommunityTile({ community, onPress, width }: { community: any; onPress: () => void; width: number }) {
  const colors = useColors();
  const name = community.name || 'Community';
  const description = community.description || community.bio || '';
  const avatar = community.image || community.avatar;
  const members = community.memberCount || community.member_count || 0;
  const postCount = community.postCount || community.post_count || 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => ({
        width,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      {/* Gold-tinted banner so communities read as places, not people. */}
      <View style={{ height: 48, backgroundColor: colors.accentMuted }} />
      <View style={{ padding: spacing.lg, marginTop: -26, gap: spacing.xs }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.xs }}>{name}</Text>
        {description ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 17, minHeight: 34 }}>{description}</Text>
        ) : <View style={{ minHeight: 34 }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people" size={12} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>{formatCount(members)}</Text>
          </View>
          {postCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{formatCount(postCount)}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
});

const AgentTile = React.memo(function AgentTile({ agent, onPress, width }: { agent: any; onPress: () => void; width: number }) {
  const colors = useColors();
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  const model = agent.model?.split('/').pop() || '';
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }: any) => ({
        width,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: hovered ? colors.surfaceHover : colors.surface,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
        gap: spacing.sm,
        ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'background-color .15s ease' } as any : {}),
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={avatar} name={name} size="md" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="sparkles" size={10} color={colors.accent} />
            <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }} numberOfLines={1}>{model || 'AI agent'}</Text>
          </View>
        </View>
      </View>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 17, minHeight: 34 }}>{bio}</Text>
      ) : <View style={{ minHeight: 34 }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.accentMuted }}>
        <Ionicons name="chatbubble-ellipses" size={13} color={colors.accent} />
        <Text variant="caption" color={colors.accent}>Chat now</Text>
      </View>
    </Pressable>
  );
});

// ──────────────────────────────────────────────────────────────────────────
// List-view cards (search results / explicit tab filter) — kept as full-width
// rows so the directory views stay scannable.
// ──────────────────────────────────────────────────────────────────────────

function FollowUnfollowButton({ isFollowed, onPress }: { isFollowed?: boolean; onPress: (e?: any) => void }) {
  const colors = useColors();
  const [toggled, setToggled] = React.useState(!!isFollowed);
  return (
    <Pressable
      onPress={(e) => { setToggled(!toggled); onPress(e); }}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.xs + 2,
        borderRadius: radius.full,
        backgroundColor: toggled ? colors.surface : colors.accentMuted,
        borderWidth: toggled ? 1 : 0,
        borderColor: colors.borderSubtle,
      }}
    >
      <Text variant="caption" color={toggled ? colors.textSecondary : colors.accent}>{toggled ? 'Following' : 'Follow'}</Text>
    </Pressable>
  );
}

function PersonRow({ person, onPress, onFollow, isFollowed }: { person: any; onPress: () => void; onFollow: () => void; isFollowed?: boolean }) {
  const colors = useColors();
  const name = person.name || 'Unknown';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  const followerCount = profileFollowerCount(person);
  const postCount = profilePostCount(person);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text variant="bodyMedium">{name}</Text>
            {username && <Text variant="caption" color={colors.textMuted}>@{username}</Text>}
          </View>
          <FollowUnfollowButton isFollowed={isFollowed} onPress={(e: any) => { e?.stopPropagation?.(); onFollow(); }} />
        </View>
        {bio ? <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{bio}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {followerCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="people-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{followerCount.toLocaleString()}</Text>
            </View>
          )}
          {postCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{postCount.toLocaleString()}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function CommunityRow({ community, onPress }: { community: any; onPress: () => void }) {
  const colors = useColors();
  const name = community.name || 'Unnamed';
  const description = community.description || community.bio || '';
  const avatar = community.image || community.avatar;
  const memberCount = community.memberCount || community.member_count || 0;
  const postCount = community.postCount || community.post_count || 0;
  const privacy = community.privacy;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{name}</Text>
          {privacy === 'private' && <Ionicons name="lock-closed" size={12} color={colors.textMuted} />}
        </View>
        {description ? <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{description}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={11} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>{memberCount.toLocaleString()}</Text>
          </View>
          {postCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{postCount.toLocaleString()}</Text>
            </View>
          )}
          {postCount >= 50 && (
            <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4 }}>
              <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>ACTIVE</Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function AgentRow({ agent, onPress }: { agent: any; onPress: () => void }) {
  const colors = useColors();
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  const model = agent.model?.split('/').pop() || '';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
        paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{name}</Text>
          <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
            <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
          </View>
        </View>
        {bio ? <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>{bio}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {model && <Text variant="caption" color={colors.textMuted}>Powered by {model}</Text>}
          <Text variant="caption" color={colors.accent}>Chat now →</Text>
        </View>
      </View>
    </Pressable>
  );
}

type DiscoverTab = 'posts' | 'people' | 'communities' | 'agents';

const TABS: { key: DiscoverTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'people', label: 'People' },
  { key: 'communities', label: 'Communities' },
  { key: 'agents', label: 'Agents' },
];

// ──────────────────────────────────────────────────────────────────────────
// Screen
// ──────────────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; mode?: string; userId?: string; q?: string }>();
  const { sdk } = useAuth();
  const colors = useColors();
  const { width: winW } = useWindowDimensions();
  const [canvasW, setCanvasW] = React.useState(0);
  const layout = React.useMemo(() => computeLayout(canvasW || Math.min(Math.max(winW - 256, 320), 1040)), [canvasW, winW]);
  const { gutter } = layout;

  const [activeTab, setActiveTab] = React.useState<DiscoverTab>((params.tab as DiscoverTab) || 'posts');
  const [searchQuery, setSearchQuery] = React.useState(params.q || '');
  React.useEffect(() => {
    if (typeof params.q === 'string' && params.q !== searchQuery) setSearchQuery(params.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  // Followers/following mode — takes over the screen.
  const [followList, setFollowList] = React.useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = React.useState(false);
  const followMode = params.mode as 'followers' | 'following' | undefined;
  const followUserId = params.userId;

  React.useEffect(() => {
    if (!followMode || !followUserId || !sdk) return;
    setFollowListLoading(true);
    (async () => {
      try {
        const res = followMode === 'followers'
          ? await sdk.profiles.followers(followUserId, { limit: 100 })
          : await sdk.profiles.following(followUserId, { limit: 100 });
        setFollowList(res.data || []);
      } catch {}
      finally { setFollowListLoading(false); }
    })();
  }, [followMode, followUserId, sdk]);

  // Discover is the front page of network content — always the score-ranked
  // network feed, never the per-user AI-curated stream (empty for anyone
  // without agent curation, which made Discover look broken).
  const { posts, loading: postsLoading, loadMore: loadMorePosts, hasMore: hasMorePosts } = usePosts('score', 40);
  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);
  const { profiles, loading: profilesLoading } = useProfiles(50);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(searchQuery);

  // Search people via SDK when searching the People tab.
  const [searchedPeople, setSearchedPeople] = React.useState<any[]>([]);
  React.useEffect(() => {
    if (!searchQuery.trim() || activeTab !== 'people' || !sdk) { setSearchedPeople([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await sdk.profiles.search({ q: searchQuery, limit: 20, organization_id: ORG_ID || undefined } as any);
        if (!cancelled) setSearchedPeople(res.data || []);
      } catch {
        if (!cancelled) setSearchedPeople([]);
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, activeTab, sdk]);

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try {
      if (followMode) await sdk.profiles.unfollow(userId);
      else await sdk.profiles.follow(userId);
    } catch {}
  };

  const filterByQuery = (items: any[], fields: string[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) => fields.some((f) => (item[f] || '').toLowerCase().includes(q)));
  };

  const goToTopic = React.useCallback((tag: string) => {
    setActiveTab('posts');
    setSearchQuery(`#${tag}`);
  }, []);

  const isSearching = searchQuery.trim().length > 0;
  const trendingTopics = React.useMemo(() => computeTrendingTopics(posts || []), [posts]);

  // ── Curated, ranked slices (all client-side over the loaded data) ──
  const hotPosts = React.useMemo(
    () => [...(posts || [])].sort((a, b) => engagementScore(b) - engagementScore(a)),
    [posts],
  );
  // Rediscover: older posts that earned engagement, ranked by score+replies.
  // Excludes anything already shown in Hot so the two sections don't overlap.
  const rediscoverPosts = React.useMemo(() => {
    const hotIds = new Set(hotPosts.slice(0, 9).map((p: any) => p.id));
    return [...(posts || [])]
      .filter((p: any) => isRediscoverable(p) && !hotIds.has(p.id))
      .sort((a, b) => (postScore(b) + postReplyCount(b)) - (postScore(a) + postReplyCount(a)))
      .slice(0, 10);
  }, [posts, hotPosts]);

  const peopleToFollow = React.useMemo(
    () => [...(profiles || [])].sort((a, b) => profileFollowerCount(b) - profileFollowerCount(a)).slice(0, 12),
    [profiles],
  );
  const activeCommunities = React.useMemo(
    () => [...(communities || [])].sort((a, b) =>
      ((b.memberCount || b.member_count || 0) + (b.postCount || b.post_count || 0)) -
      ((a.memberCount || a.member_count || 0) + (a.postCount || a.post_count || 0)),
    ).slice(0, 12),
    [communities],
  );
  const topAgents = React.useMemo(() => (agents || []).slice(0, 12), [agents]);

  const toPost = (p: any) => router.push(`/(tabs)/post/${p.id}` as any);
  const toUser = (u: any) => router.push(`/(tabs)/user/${u.username || u.id}` as any);
  const toCommunity = (c: any) => router.push(`/(tabs)/community/${c.slug || c.id}` as any);

  // ── Curated front page ──
  const renderCanvas = () => {
    const firstLoad = postsLoading && (posts || []).length === 0;

    if (firstLoad) {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing['4xl'] }}>
          <View style={{ paddingHorizontal: gutter, paddingTop: spacing.lg, gap: spacing.lg }}>
            <Skeleton width="100%" height={layout.isWide ? 300 : 220} borderRadius={radius.xl} />
          </View>
          <View style={{ paddingTop: spacing['2xl'] }}>
            <RailSkeleton gutter={gutter} width={POST_TILE_W} height={200} />
          </View>
          <View style={{ paddingTop: spacing['2xl'] }}>
            <RailSkeleton gutter={gutter} width={ENTITY_TILE_W} height={190} />
          </View>
        </ScrollView>
      );
    }

    const nothing = (posts || []).length === 0 && (profiles || []).length === 0 && (communities || []).length === 0 && (agents || []).length === 0;
    if (nothing) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <View style={{ width: 72, height: 72, borderRadius: radius.full, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="compass-outline" size={34} color={colors.accent} />
          </View>
          <Text variant="h2" color={colors.text} align="center">Nothing here yet</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 340, lineHeight: 24 }}>
            Be the first — create a post to start the conversation. As people join and post, this becomes your front page.
          </Text>
          <Button onPress={() => router.push('/(tabs)/create')} size="sm">Create a post</Button>
        </View>
      );
    }

    const featured = hotPosts[0];
    const hotRail = hotPosts.slice(1, 13);

    // Entity tile width: shrink on phones so two peek at the edge; fixed on wide.
    const entityW = layout.isWide ? ENTITY_TILE_W : Math.min(ENTITY_TILE_W, Math.max(160, (layout.width - gutter * 2 - spacing.md) / 2));

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing['4xl'] }}>
        {/* Trending topics — live hashtag pulse into search */}
        {trendingTopics.length > 0 ? (
          <TrendingTopicsRow topics={trendingTopics} onPick={goToTopic} gutter={gutter} />
        ) : null}

        {/* HOT — featured lead + carousel of top-scored posts */}
        {featured ? (
          <>
            <SectionHeader
              title="Hot right now"
              subtitle="The posts the network is voting up"
              icon="flame"
              gutter={gutter}
              onSeeAll={() => { setActiveTab('posts'); router.setParams({ tab: 'posts' }); }}
            />
            <View style={{ paddingHorizontal: gutter }}>
              <FeaturedPost post={featured} layout={layout} onPress={() => toPost(featured)} />
            </View>
            {hotRail.length > 0 ? (
              <View style={{ marginTop: spacing.lg }}>
                <HorizontalRail gutter={gutter} snap={POST_TILE_W + spacing.md}>
                  {hotRail.map((p: any) => (
                    <PostTile key={p.id} post={p} width={POST_TILE_W} onPress={() => toPost(p)} />
                  ))}
                </HorizontalRail>
              </View>
            ) : null}
          </>
        ) : null}

        {/* VOICES TO FOLLOW */}
        {(profilesLoading || peopleToFollow.length > 0) && (
          <>
            <SectionHeader title="Voices to follow" subtitle="Creators with a following on Minds" icon="people-outline" gutter={gutter} onSeeAll={() => { setActiveTab('people'); router.setParams({ tab: 'people' }); }} />
            {profilesLoading && peopleToFollow.length === 0 ? (
              <RailSkeleton gutter={gutter} width={entityW} height={200} />
            ) : (
              <HorizontalRail gutter={gutter} snap={entityW + spacing.md}>
                {peopleToFollow.map((p: any) => (
                  <PersonTile key={p.id} person={p} width={entityW} isFollowed={!!(p.isFollowing || p.is_following)} onPress={() => toUser(p)} onFollow={() => handleFollow(p.id)} />
                ))}
              </HorizontalRail>
            )}
          </>
        )}

        {/* COMMUNITIES */}
        {(commLoading || activeCommunities.length > 0) && (
          <>
            <SectionHeader title="Communities to join" subtitle="Where the conversations are happening" icon="people" gutter={gutter} onSeeAll={() => { setActiveTab('communities'); router.setParams({ tab: 'communities' }); }} />
            {commLoading && activeCommunities.length === 0 ? (
              <RailSkeleton gutter={gutter} width={entityW} height={180} />
            ) : (
              <HorizontalRail gutter={gutter} snap={entityW + spacing.md}>
                {activeCommunities.map((c: any) => (
                  <CommunityTile key={c.id} community={c} width={entityW} onPress={() => toCommunity(c)} />
                ))}
              </HorizontalRail>
            )}
          </>
        )}

        {/* AGENTS */}
        {(agentsLoading || topAgents.length > 0) && (
          <>
            <SectionHeader title="Talk to an agent" subtitle="AI you can chat with, right here" icon="sparkles" gutter={gutter} onSeeAll={() => { setActiveTab('agents'); router.setParams({ tab: 'agents' }); }} />
            {agentsLoading && topAgents.length === 0 ? (
              <RailSkeleton gutter={gutter} width={entityW} height={170} />
            ) : (
              <HorizontalRail gutter={gutter} snap={entityW + spacing.md}>
                {topAgents.map((a: any) => (
                  <AgentTile key={a.id} agent={a} width={entityW} onPress={() => toUser(a)} />
                ))}
              </HorizontalRail>
            )}
          </>
        )}

        {/* REDISCOVER — buried gems: real engagement, older posts */}
        {rediscoverPosts.length > 0 && (
          <>
            <SectionHeader title="Rediscover" subtitle="Great posts worth a second look" icon="time-outline" gutter={gutter} />
            <HorizontalRail gutter={gutter} snap={REDISCOVER_TILE_W + spacing.md}>
              {rediscoverPosts.map((p: any) => (
                <RediscoverTile key={p.id} post={p} width={REDISCOVER_TILE_W} onPress={() => toPost(p)} />
              ))}
            </HorizontalRail>
          </>
        )}
      </ScrollView>
    );
  };

  // ── List view (search results or specific tab) ──
  const getData = (): { type: string; data: any; key: string }[] => {
    if (activeTab === 'posts') {
      const filtered = isSearching ? searchResults : filterByQuery(posts || [], ['content', 'title']);
      return filtered.map((p: any, i: number) => ({ type: 'post', data: p, key: `p-${p.id || i}` }));
    }
    if (activeTab === 'people') {
      if (followMode) {
        return filterByQuery(followList, ['name', 'username', 'bio']).map((p: any, i: number) => ({ type: 'person', data: p, key: `u-${p.id || i}` }));
      }
      const source = isSearching && searchedPeople.length > 0 ? searchedPeople : filterByQuery(profiles || [], ['name', 'username', 'bio']);
      return source.map((p: any, i: number) => ({ type: 'person', data: p, key: `u-${p.id || i}` }));
    }
    if (activeTab === 'communities') {
      return filterByQuery(communities || [], ['name', 'description']).map((c: any, i: number) => ({ type: 'community', data: c, key: `c-${c.id || i}` }));
    }
    if (activeTab === 'agents') {
      return filterByQuery(agents || [], ['name', 'bio', 'description']).map((a: any, i: number) => ({ type: 'agent', data: a, key: `a-${a.id || i}` }));
    }
    return [];
  };

  const loading = activeTab === 'posts' ? (isSearching ? searchLoading : postsLoading)
    : activeTab === 'people' ? (followMode ? followListLoading : profilesLoading)
    : activeTab === 'communities' ? commLoading
    : agentsLoading;

  const items = getData();

  const renderItem = ({ item }: { item: { type: string; data: any; key: string } }) => {
    if (item.type === 'post') return <PostCard post={item.data} compact />;
    if (item.type === 'person') {
      return (
        <PersonRow
          person={item.data}
          isFollowed={!!followMode}
          onPress={() => toUser(item.data)}
          onFollow={() => handleFollow(item.data.id)}
        />
      );
    }
    if (item.type === 'community') return <CommunityRow community={item.data} onPress={() => toCommunity(item.data)} />;
    if (item.type === 'agent') return <AgentRow agent={item.data} onPress={() => toUser(item.data)} />;
    return null;
  };

  // Curated canvas only on the default landing — no search, no follow-list, no
  // explicit tab. Once the user types, taps "See all", or arrives as a
  // followers list, fall through to the tab + list shape.
  const showCanvas = !isSearching && !followMode && !params.tab;

  return (
    <Container safeTop padded={false}>
      <View style={{ backgroundColor: colors.bg, zIndex: 1 }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.md,
            paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
            borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
          }}
        >
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1 }}>{followMode === 'followers' ? 'Followers' : followMode === 'following' ? 'Following' : 'Discover'}</Text>
        </View>

        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
          <View
            style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: colors.surface, borderRadius: radius.full,
              borderWidth: 0.5, borderColor: colors.glassBorder,
              paddingHorizontal: spacing.md, gap: spacing.sm,
            }}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Search posts, people, communities, agents…"
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1, color: colors.text, ...typography.body, paddingVertical: 11,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {!showCanvas && (
          <TabBar tabs={TABS} active={activeTab} onChange={(k) => setActiveTab(k as DiscoverTab)} scrollable />
        )}
      </View>

      <View
        style={{ flex: 1 }}
        onLayout={(e) => { const w = e.nativeEvent.layout.width; if (w && Math.abs(w - canvasW) > 1) setCanvasW(w); }}
      >
        {showCanvas ? (
          renderCanvas()
        ) : loading ? (
          <View style={{ padding: spacing.xl, gap: spacing.xl }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <View key={i} style={{ gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                  <Skeleton width={44} height={44} borderRadius={22} />
                  <View style={{ flex: 1, gap: spacing.xs }}>
                    <Skeleton width={160} height={14} />
                    <Skeleton width={100} height={12} />
                  </View>
                </View>
                <Skeleton width="100%" height={40} />
              </View>
            ))}
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            renderItem={renderItem}
            onEndReached={activeTab === 'posts' && !isSearching ? loadMorePosts : undefined}
            onEndReachedThreshold={0.5}
            ListFooterComponent={activeTab === 'posts' && !isSearching && hasMorePosts && items.length > 0 ? (
              <View style={{ padding: spacing.xl, alignItems: 'center' }}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null}
            ListHeaderComponent={
              <>
                {activeTab === 'communities' && !isSearching && (
                  <Pressable
                    onPress={() => router.push('/(tabs)/create?mode=community' as any)}
                    style={({ pressed }) => ({
                      flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                      paddingHorizontal: spacing.xl, paddingVertical: spacing.lg,
                      borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle,
                      backgroundColor: pressed ? colors.surfaceHover : colors.surface,
                    })}
                  >
                    <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="add" size={22} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyMedium" color={colors.accent}>Start a community</Text>
                      <Text variant="caption" color={colors.textMuted}>Gather people around a shared interest</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                )}
                {items.length > 0 && (
                  <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
                    <Text variant="caption" color={colors.textMuted}>
                      {isSearching
                        ? `${items.length} result${items.length !== 1 ? 's' : ''}`
                        : activeTab === 'posts' ? `${items.length} trending posts`
                        : activeTab === 'people' ? `${items.length} people on the network`
                        : activeTab === 'communities' ? `${items.length} communities to join`
                        : `${items.length} agents you can chat with`}
                    </Text>
                  </View>
                )}
              </>
            }
            ListEmptyComponent={
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
                <Ionicons
                  name={
                    activeTab === 'communities' ? 'people-outline'
                    : activeTab === 'agents' ? 'hardware-chip-outline'
                    : activeTab === 'people' ? 'person-outline'
                    : activeTab === 'posts' ? 'newspaper-outline'
                    : 'compass-outline'
                  }
                  size={40}
                  color={colors.accent}
                />
                <Text variant="h2" color={colors.text} align="center">
                  {searchQuery ? 'No Results' : `Discover ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
                </Text>
                <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300, lineHeight: 24 }}>
                  {searchQuery ? 'Try a different search term.' : 'Be the first to create something.'}
                </Text>
                {!searchQuery && (
                  <Button onPress={() => router.push('/(tabs)/create')} size="sm" style={{ marginTop: spacing.md }}>Create</Button>
                )}
              </View>
            }
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Container>
  );
}
