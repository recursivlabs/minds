import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable, ActivityIndicator, ScrollView, Image, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Button, Skeleton, PostCard } from '../../components';
import { Container } from '../../components/Container';
import { TabBar } from '../../components/TabBar';
import { usePosts, useCommunities, useAgents, useProfiles, useSearchPosts } from '../../lib/hooks';
import { useAuth } from '../../lib/auth';
import { getPreference } from '../../lib/preferences';
import { logSignal } from '../../lib/signals';
import { ORG_ID } from '../../lib/recursiv';
import { spacing, radius, typography, shadows } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { profileFollowerCount } from '../../lib/models';
import { resolvePersonalAgent } from '../../lib/resolvePersonalAgent';

// ── Responsive layout helpers ──
// The editorial canvas adapts to viewport width: a single rich column on
// phones, a multi-column magazine mosaic on tablets/desktop. We resolve a
// "layout profile" once per render from useWindowDimensions() and thread the
// content max-width + column count through the modules so everything lines up
// on a shared centered measure (premium media sites never run edge-to-edge on
// a wide monitor).
type Layout = {
  width: number;
  isWide: boolean;       // tablet and up — switch to multi-column mosaic
  isUltra: boolean;      // very wide desktop — 3-up mosaic, wider hero
  contentWidth: number;  // centered max measure for the whole canvas
  gutter: number;        // horizontal page padding
  mosaicCols: number;    // standard-tile columns under the hero
};

function useLayout(): Layout {
  const { width } = useWindowDimensions();
  const isWide = width >= 768;
  const isUltra = width >= 1180;
  // Cap the reading measure so headlines don't sprawl on a 1400px+ monitor.
  const maxMeasure = isUltra ? 1120 : isWide ? 760 : width;
  const contentWidth = Math.min(width, maxMeasure);
  const gutter = isWide ? spacing['2xl'] : spacing.xl;
  const mosaicCols = isUltra ? 3 : isWide ? 2 : 1;
  return { width, isWide, isUltra, contentWidth, gutter, mosaicCols };
}

// A cross-platform cover image. The previous hero only painted on web
// (raw <img>); native fell back to an empty grey box. RN <Image> covers both.
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
      <Text variant="caption" color={toggled ? colors.textSecondary : colors.accent}>
        {toggled ? 'Following' : 'Follow'}
      </Text>
    </Pressable>
  );
}

// ── Trending topics, derived live from the loaded posts ──
// The old TOPIC_CHIPS were hardcoded regex buckets that pretended to
// classify every post. They were a relic. Instead we now surface the
// hashtags/tags that are ACTUALLY trending in the day's reading list —
// counted from real post data — so the row is alive and changes with the
// feed. Tapping a topic routes into the existing search path (no new
// filtering machinery), keeping the canvas honest.

type TrendingTopic = { tag: string; count: number };

function extractHashtags(text: string | null | undefined): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /#([\p{L}\p{N}_]{2,30})/gu;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) out.push(m[1].toLowerCase());
  return out;
}

function computeTrendingTopics(posts: any[], limit = 10): TrendingTopic[] {
  const counts = new Map<string, { display: string; count: number }>();
  for (const p of posts || []) {
    const tags: string[] = [];
    // Explicit tags on the post take priority, then inline #hashtags.
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
      if (seen.has(key)) continue; // count each tag once per post
      seen.add(key);
      const prev = counts.get(key);
      if (prev) prev.count += 1;
      else counts.set(key, { display: raw, count: 1 });
    }
  }
  return [...counts.values()]
    .filter((t) => t.count >= 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((t) => ({ tag: t.display, count: t.count }));
}

function getDomain(url: string | null | undefined): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch { return ''; }
}

function extractUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/https?:\/\/\S+/);
  return m ? m[0].replace(/[.,;:!?)\]]+$/, '') : null;
}

function postSource(post: any): string {
  // Curator posts carry source on post.source_name; legacy posts may
  // carry the URL inline. Prefer explicit field, fall back to URL.
  if (post.source_name) return String(post.source_name);
  if (post.sourceName) return String(post.sourceName);
  const url = post.external_url || post.externalUrl || extractUrl(post.content);
  return getDomain(url) || 'minds';
}

function postCategory(post: any): string {
  // Eyebrow label for headlines. Uses the post's own first tag/hashtag
  // (real data) so a row reads "AI · TechCrunch" instead of a guessed
  // bucket. Empty when the post carries no tags.
  const tag = Array.isArray(post?.tags) && post.tags.length
    ? String(post.tags[0]).replace(/^#/, '')
    : extractHashtags(post?.content)[0] || extractHashtags(post?.title)[0] || '';
  return tag ? tag.toUpperCase() : '';
}

function postAITake(post: any): string {
  // Curator stores the agent's editorial caption on post.content;
  // the original article link lives on external_url. Show the first
  // ~120 chars as the AI take. If content IS just the URL, skip.
  const body = (post.content || '').trim();
  if (!body) return '';
  if (/^https?:\/\//.test(body)) return '';
  const firstSentence = body.split(/(?<=[.!?])\s+/)[0] || body;
  return firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}…` : firstSentence;
}

// ── HERO ──
// The marquee of the front page. When the lead post carries an image we
// run an immersive cover with a dark scrim and the headline laid over the
// art (Apple News / premium-media treatment); without an image we fall back
// to a tall typographic card with a gold rule so it still reads as "lead".
// The card itself is a rounded, bordered surface that floats on the canvas.
function DiscoverHero({ post, onPress, layout }: { post: any; onPress: () => void; layout: Layout }) {
  const colors = useColors();
  const image = post.image || post.previewImage;
  const source = postSource(post);
  const category = postCategory(post);
  const take = postAITake(post);
  const replies = post.replyCount || post.reply_count || 0;
  const title = post.title || (post.content || '').split('\n')[0].slice(0, 140);
  const coverHeight = layout.isUltra ? 460 : layout.isWide ? 380 : 300;
  React.useEffect(() => {
    if (post?.id) logSignal('view', { postId: post.id, metadata: { surface: 'discover_hero' } });
  }, [post?.id]);

  const eyebrow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm }}>
        <Ionicons name="sparkles" size={11} color={colors.textOnAccent} />
        <Text variant="label" color={colors.textOnAccent} style={{ fontSize: 10, letterSpacing: 1 }}>LEAD STORY</Text>
      </View>
      {category ? (
        <Text variant="label" color={image ? '#fff' : colors.accent} style={{ fontSize: 10, letterSpacing: 1.4 }}>
          {category}
        </Text>
      ) : null}
    </View>
  );

  const meta = (onImage: boolean) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', marginTop: spacing.xs }}>
      <Text variant="caption" color={onImage ? 'rgba(255,255,255,0.82)' : colors.textMuted}>{source}</Text>
      {replies > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Ionicons name="chatbubble-outline" size={11} color={onImage ? 'rgba(255,255,255,0.82)' : colors.textMuted} />
          <Text variant="caption" color={onImage ? 'rgba(255,255,255,0.82)' : colors.textMuted}>{replies} on Minds</Text>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' as any }}>
        <Text variant="caption" color={colors.accent}>Read story</Text>
        <Ionicons name="arrow-forward" size={12} color={colors.accent} />
      </View>
    </View>
  );

  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_hero' } }); onPress(); }}
      style={({ pressed }) => ({
        borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: image ? 0 : 1,
        borderColor: colors.borderSubtle,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.96 : 1,
        ...shadows.lg(colors.shadow),
      })}
    >
      {image ? (
        <View style={{ position: 'relative' }}>
          <CoverImage uri={image} height={coverHeight} />
          {/* Dark scrim so overlaid headline stays legible on any art. */}
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: '35%', backgroundColor: 'rgba(0,0,0,0.55)' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: 0, backgroundColor: 'rgba(0,0,0,0.18)' }} />
          <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: layout.isWide ? spacing['2xl'] : spacing.xl, gap: spacing.sm }}>
            {eyebrow}
            <Text variant={layout.isWide ? 'hero' : 'h1'} color="#fff" numberOfLines={4} style={{ maxWidth: 760 }}>
              {title}
            </Text>
            {take ? (
              <Text variant="body" color="rgba(255,255,255,0.88)" numberOfLines={2} style={{ maxWidth: 640, lineHeight: 22 }}>
                {take}
              </Text>
            ) : null}
            {meta(true)}
          </View>
        </View>
      ) : (
        <View style={{ padding: layout.isWide ? spacing['3xl'] : spacing['2xl'], gap: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.accent }}>
          {eyebrow}
          <Text variant={layout.isWide ? 'hero' : 'h1'} color={colors.text} numberOfLines={4}>
            {title}
          </Text>
          {take ? (
            <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ lineHeight: 24, maxWidth: 640 }}>
              {take}
            </Text>
          ) : null}
          {meta(false)}
        </View>
      )}
    </Pressable>
  );
}

// ── MOSAIC TILE ──
// A standard editorial card for the multi-column grid. Renders its own cover
// art when present (top image), then eyebrow + headline + AI take + meta. Used
// for the secondary stories directly under the hero. On mobile these stack to
// one rich column; on desktop they tile 2- or 3-up.
function MosaicTile({ post, onPress, featured }: { post: any; onPress: () => void; featured?: boolean }) {
  const colors = useColors();
  const image = post.image || post.previewImage;
  const source = postSource(post);
  const category = postCategory(post);
  const take = postAITake(post);
  const replies = post.replyCount || post.reply_count || 0;
  const score = post.score || 0;
  const title = post.title || (post.content || '').split('\n')[0];
  React.useEffect(() => {
    if (post?.id) logSignal('view', { postId: post.id, metadata: { surface: 'discover_mosaic' } });
  }, [post?.id]);
  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_mosaic' } }); onPress(); }}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: radius.lg,
        overflow: 'hidden',
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        ...shadows.sm(colors.shadow),
      })}
    >
      {image ? <CoverImage uri={image} height={featured ? 200 : 160} /> : null}
      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        <Text variant="label" color={colors.accent} style={{ fontSize: 10, letterSpacing: 1 }}>
          {category ? `${category} · ${source}` : source.toUpperCase()}
        </Text>
        <Text variant={featured ? 'h3' : 'bodyMedium'} color={colors.text} numberOfLines={3} style={{ lineHeight: featured ? 24 : 21 }}>
          {title || 'Untitled'}
        </Text>
        {take ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ lineHeight: 18 }}>
            {take}
          </Text>
        ) : null}
        {(replies > 0 || score > 0) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs }}>
            {replies > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="chatbubble-outline" size={11} color={colors.textMuted} />
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{replies}</Text>
              </View>
            ) : null}
            {score > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="arrow-up" size={11} color={colors.accent} />
                <Text variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{score}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// Lays a flat list of tiles into an N-column responsive grid using flex rows.
// We chunk into rows of `cols` and pad the final row with invisible spacers so
// the last row's tiles keep their width instead of stretching full-bleed.
function MosaicGrid({ posts, cols, gutter, onPick }: { posts: any[]; cols: number; gutter: number; onPick: (p: any) => void }) {
  if (!posts.length) return null;
  const rows: any[][] = [];
  for (let i = 0; i < posts.length; i += cols) rows.push(posts.slice(i, i + cols));
  return (
    <View style={{ paddingHorizontal: gutter, gap: spacing.lg }}>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row', gap: spacing.lg }}>
          {row.map((p) => (
            <MosaicTile key={p.id} post={p} featured={cols === 1} onPress={() => onPick(p)} />
          ))}
          {row.length < cols
            ? Array.from({ length: cols - row.length }).map((_, k) => <View key={`sp-${k}`} style={{ flex: 1 }} />)
            : null}
        </View>
      ))}
    </View>
  );
}

function DenseHeadline({ post, onPress, gutter = spacing.xl }: { post: any; onPress: () => void; gutter?: number }) {
  const colors = useColors();
  const source = postSource(post);
  const category = postCategory(post);
  const take = postAITake(post);
  const replies = post.replyCount || post.reply_count || 0;
  const score = post.score || 0;
  const title = post.title || (post.content || '').split('\n')[0];
  // Log a view when the row mounts. Dedup inside logSignal keeps
  // this from counting the same post twice across re-renders.
  React.useEffect(() => {
    if (post?.id) logSignal('view', { postId: post.id, metadata: { surface: 'discover_dense' } });
  }, [post?.id]);
  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_dense' } }); onPress(); }}
      style={({ pressed }) => ({
        paddingVertical: spacing.md,
        paddingHorizontal: gutter,
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        gap: 2,
      })}
    >
      <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10, letterSpacing: 0.8 }}>
        {category ? `${category} · ` : ''}{source}
      </Text>
      <Text variant="bodyMedium" color={colors.text} numberOfLines={2} style={{ lineHeight: 20 }}>
        {title || 'Untitled'}
      </Text>
      {take ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ fontStyle: 'italic' }}>
          {take}
        </Text>
      ) : null}
      {(replies > 0 || score > 0) ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 }}>
          {replies > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chatbubble-outline" size={10} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{replies}</Text>
            </View>
          ) : null}
          {score > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="arrow-up-outline" size={10} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{score}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

// Live trending-topics rail. Each chip is a real hashtag counted from
// the loaded posts; tapping it searches that topic via the existing
// search path. The leading "Trending" label + flame icon make it read
// as a pulse on the network rather than a static filter set.
function TrendingTopicsRow({ topics, onPick, gutter = spacing.xl }: { topics: TrendingTopic[]; onPick: (tag: string) => void; gutter?: number }) {
  const colors = useColors();
  if (!topics.length) return null;
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingHorizontal: gutter,
          paddingTop: spacing.lg,
          paddingBottom: spacing.xs,
        }}
      >
        <Ionicons name="flame" size={13} color={colors.accent} />
        <Text variant="caption" color={colors.textMuted} style={{ letterSpacing: 1.2, fontSize: 10 }}>
          TRENDING NOW
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingVertical: spacing.sm, gap: spacing.sm }}
      >
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
              marginRight: spacing.sm,
            })}
          >
            <Text variant="caption" color={colors.accent} style={{ fontSize: 12 }}>#</Text>
            <Text variant="caption" color={colors.text} style={{ fontSize: 12 }}>{t.tag}</Text>
            {t.count > 1 ? (
              <Text variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t.count}</Text>
            ) : null}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function EndOfBrief({ onAsk }: { onAsk: () => void }) {
  const colors = useColors();
  return (
    <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing['3xl'], gap: spacing.md, alignItems: 'center' }}>
      <Text variant="caption" color={colors.textMuted} style={{ letterSpacing: 1.5, fontSize: 10 }}>
        END OF TODAY'S BRIEF
      </Text>
      <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 320, lineHeight: 22 }}>
        That's your reading list. Ask your agent what to dig into next.
      </Text>
      <Pressable
        onPress={onAsk}
        style={({ pressed }) => ({
          marginTop: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.accent,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text variant="bodyMedium" color={colors.accent}>Ask my agent</Text>
      </Pressable>
    </View>
  );
}

type DiscoverTab = 'posts' | 'people' | 'communities' | 'agents';

const TABS: { key: DiscoverTab; label: string }[] = [
  { key: 'posts', label: 'Posts' },
  { key: 'people', label: 'People' },
  { key: 'communities', label: 'Communities' },
  { key: 'agents', label: 'Agents' },
];

function PersonCard({ person, onPress, onFollow, isFollowed }: { person: any; onPress: () => void; onFollow: () => void; isFollowed?: boolean }) {
  const colors = useColors();
  const name = person.name || 'Unknown';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  const followerCount = profileFollowerCount(person);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
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
        {bio ? (
          <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
            {bio}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {followerCount > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="people-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{followerCount.toLocaleString()}</Text>
            </View>
          )}
          {(person.postCount || person.post_count) ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{(person.postCount || person.post_count).toLocaleString()}</Text>
            </View>
          ) : null}
          {(person.createdAt || person.created_at) && (() => {
            const joined = new Date(person.createdAt || person.created_at).getTime();
            const newish = Date.now() - joined < 7 * 86_400_000;
            return newish ? (
              <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 1, borderRadius: 4 }}>
                <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>NEW</Text>
              </View>
            ) : (
              <Text variant="caption" color={colors.textMuted}>Joined {timeAgoShort(person.createdAt || person.created_at)}</Text>
            );
          })()}
        </View>
      </View>
    </Pressable>
  );
}

function timeAgoShort(dateStr?: string): string {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

function CommunityCard({ community, onPress }: { community: any; onPress: () => void }) {
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
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="bodyMedium" style={{ flex: 1 }} numberOfLines={1}>{name}</Text>
          {privacy === 'private' && (
            <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          )}
        </View>
        {description ? (
          <Text variant="body" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
            {description}
          </Text>
        ) : null}
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

function AgentCard({ agent, onPress }: { agent: any; onPress: () => void }) {
  const colors = useColors();
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  const model = agent.model?.split('/').pop() || '';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.lg,
        backgroundColor: pressed ? colors.surfaceHover : 'transparent',
        borderBottomWidth: 0.5,
        borderBottomColor: colors.borderSubtle,
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
        {bio ? (
          <Text variant="body" color={colors.textSecondary} numberOfLines={4} style={{ marginTop: spacing.xs, lineHeight: 20 }}>
            {bio}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          {model && <Text variant="caption" color={colors.textMuted}>Powered by {model}</Text>}
          <Text variant="caption" color={colors.accent}>Chat now →</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ── Compact carousel tiles used on the editorial canvas. ──
// These are deliberately smaller than the full row cards above so a
// horizontal scroll preview fits three to four items on a phone and six
// on web without feeling cramped.

const TILE_WIDTH = 260;

// ── Polished module tiles ──
// These are the people / community / agent cards that live in the horizontal
// rails. They're taller, rounded, shadowed "trading cards" with a clear CTA —
// not thin list rows. Each is a fixed width so the rail previews 1–2 on a
// phone and 4+ on a wide monitor, with snap-free smooth scroll.

function PersonTile({ person, onPress, onFollow, isFollowed }: { person: any; onPress: () => void; onFollow?: () => void; isFollowed?: boolean }) {
  const colors = useColors();
  const name = person.name || 'Unknown';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  const followers = profileFollowerCount(person);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        padding: spacing.lg,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        ...shadows.sm(colors.shadow),
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
          {username ? <Text variant="caption" color={colors.textMuted} numberOfLines={1}>@{username}</Text> : null}
        </View>
      </View>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.md, lineHeight: 18, minHeight: 36 }}>
          {bio}
        </Text>
      ) : <View style={{ minHeight: 36 + spacing.md }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.md }}>
        {followers > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={12} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>{followers.toLocaleString()}</Text>
          </View>
        ) : <View />}
        {onFollow ? (
          <FollowUnfollowButton isFollowed={isFollowed} onPress={(e: any) => { e?.stopPropagation?.(); onFollow(); }} />
        ) : null}
      </View>
    </Pressable>
  );
}

function CommunityTile({ community, onPress }: { community: any; onPress: () => void }) {
  const colors = useColors();
  const name = community.name || 'Unnamed';
  const description = community.description || community.bio || '';
  const avatar = community.image || community.avatar;
  const memberCount = community.memberCount || community.member_count || 0;
  const postCount = community.postCount || community.post_count || 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: 'hidden',
        ...shadows.sm(colors.shadow),
      })}
    >
      {/* Gold-tinted banner band so communities read as places, not people. */}
      <View style={{ height: 56, backgroundColor: colors.accentMuted }} />
      <View style={{ padding: spacing.lg, marginTop: -28 }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.sm }}>{name}</Text>
        {description ? (
          <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.xs, lineHeight: 18, minHeight: 36 }}>
            {description}
          </Text>
        ) : <View style={{ minHeight: 36 + spacing.xs }} />}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="people-outline" size={12} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted}>{memberCount.toLocaleString()}</Text>
          </View>
          {postCount > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="newspaper-outline" size={12} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{postCount.toLocaleString()}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function AgentTile({ agent, onPress }: { agent: any; onPress: () => void }) {
  const colors = useColors();
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  const model = agent.model?.split('/').pop() || '';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        padding: spacing.lg,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        ...shadows.sm(colors.shadow),
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <View style={{ flex: 1 }}>
          <Text variant="bodyMedium" numberOfLines={1}>{name}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <Ionicons name="sparkles" size={10} color={colors.accent} />
            <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>{model || 'AI agent'}</Text>
          </View>
        </View>
      </View>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={2} style={{ marginTop: spacing.md, lineHeight: 18, minHeight: 36 }}>
          {bio}
        </Text>
      ) : <View style={{ minHeight: 36 + spacing.md }} />}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginTop: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full,
          backgroundColor: colors.accentMuted,
        }}
      >
        <Ionicons name="chatbubble-ellipses" size={13} color={colors.accent} />
        <Text variant="caption" color={colors.accent}>Chat now</Text>
      </View>
    </Pressable>
  );
}

function SectionHeader({ title, subtitle, onSeeAll, icon, gutter = spacing.xl }: { title: string; subtitle?: string; onSeeAll?: () => void; icon?: keyof typeof Ionicons.glyphMap; gutter?: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: gutter,
        paddingTop: spacing['3xl'],
        paddingBottom: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          {/* Gold tick — a small accent bar that gives every module a masthead feel. */}
          <View style={{ width: 4, height: 18, borderRadius: 2, backgroundColor: colors.accent }} />
          {icon ? <Ionicons name={icon} size={16} color={colors.text} /> : null}
          <Text variant="h2">{title}</Text>
        </View>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2, marginLeft: spacing.sm + 4 }}>{subtitle}</Text>
        ) : null}
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text variant="caption" color={colors.accent}>See all</Text>
          <Ionicons name="arrow-forward" size={12} color={colors.accent} />
        </Pressable>
      ) : null}
    </View>
  );
}

function HorizontalCarousel({ children, loading, gutter = spacing.xl }: { children: React.ReactNode; loading?: boolean; gutter?: number }) {
  if (loading) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.sm }}
      >
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ marginRight: spacing.md }}>
            <Skeleton width={TILE_WIDTH} height={172} borderRadius={radius.lg} />
          </View>
        ))}
      </ScrollView>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: spacing.sm }}
    >
      {children}
    </ScrollView>
  );
}

export default function DiscoverScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; mode?: string; userId?: string; q?: string }>();
  const { sdk } = useAuth();
  const colors = useColors();
  const layout = useLayout();
  const [activeTab, setActiveTab] = React.useState<DiscoverTab>(
    (params.tab as DiscoverTab) || 'posts'
  );
  const [searchQuery, setSearchQuery] = React.useState(params.q || '');
  // Sync the ?q= route param into the search box on EVERY navigation. The
  // global search (command palette) lands here via /discover?q=…, but useState
  // only seeds on mount — expo-router keeps this tab alive, so searching while
  // Discover was already mounted left searchQuery empty and dropped you on the
  // browse homepage instead of the results. This makes the query always apply.
  React.useEffect(() => {
    if (typeof params.q === 'string' && params.q !== searchQuery) setSearchQuery(params.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);
  // Followers/following mode — kept as-is, takes over the screen
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

  // Pull from the user's personal curated stream when AI is on (the
  // agent's hand-picked reading list); fall back to score-ranked
  // network posts when AI is off so the page isn't empty for users
  // with the master switch flipped.
  const aiEnabled = getPreference('aiEnabled');
  const { posts, loading: postsLoading, loadMore: loadMorePosts, hasMore: hasMorePosts } = usePosts(aiEnabled ? 'personal' : 'score', 30);
  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);
  const { profiles, loading: profilesLoading } = useProfiles(50);
  const { results: searchResults, loading: searchLoading } = useSearchPosts(searchQuery);

  // Search people via SDK when searching
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
      if (followMode) {
        await sdk.profiles.unfollow(userId);
      } else {
        await sdk.profiles.follow(userId);
      }
    } catch {}
  };

  const filterByQuery = (items: any[], fields: string[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item) =>
      fields.some((f) => (item[f] || '').toLowerCase().includes(q))
    );
  };

  // Tapping a trending topic routes into the existing search path. We
  // land on the Posts tab and drop the query into the box, which the
  // useSearchPosts hook + isSearching gating already handle.
  const goToTopic = React.useCallback((tag: string) => {
    setActiveTab('posts');
    setSearchQuery(`#${tag}`);
  }, []);

  const isSearching = searchQuery.trim().length > 0;

  // Live trending topics from the loaded reading list. Recomputed only
  // when the post set changes.
  const trendingTopics = React.useMemo(() => computeTrendingTopics(posts || []), [posts]);

  // ── Discover canvas: editorial front page ──
  // The masthead of Minds. A bold lead hero, then a responsive magazine mosaic
  // of secondary stories (multi-column on desktop, one rich column on mobile),
  // broken up by polished people / community / agent modules and a live
  // trending strip. Everything sits on a centered max-measure so it reads as a
  // designed page at 390px AND 1400px. Topic taps + "See all" route into the
  // existing search / tab paths untouched.
  const { gutter, contentWidth, mosaicCols } = layout;

  const renderCanvas = () => {
    if (postsLoading && (posts || []).length === 0) {
      return (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing['3xl'] }}>
          <View style={{ width: contentWidth, paddingHorizontal: gutter, gap: spacing.lg }}>
            <Skeleton width="100%" height={layout.isWide ? 380 : 300} borderRadius={radius.xl} />
            <View style={{ flexDirection: layout.isWide ? 'row' : 'column', gap: spacing.lg }}>
              {[1, 2, 3].slice(0, mosaicCols || 1).map((i) => (
                <View key={i} style={{ flex: 1, gap: spacing.sm }}>
                  <Skeleton width="100%" height={160} borderRadius={radius.lg} />
                  <Skeleton width="80%" height={16} />
                  <Skeleton width="60%" height={12} />
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      );
    }
    if ((posts || []).length === 0) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <View style={{ width: 72, height: 72, borderRadius: radius.full, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="newspaper-outline" size={34} color={colors.accent} />
          </View>
          <Text variant="h2" color={colors.text} align="center">Your front page is loading</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 340, lineHeight: 24 }}>
            Set up your personal AI agent and it'll curate the day's stories, people, and communities right here.
          </Text>
          <Button onPress={() => router.push('/agent' as any)} size="sm">Set up agent</Button>
        </View>
      );
    }

    const hero = (posts || []).find((p: any) => p.image || p.previewImage) || (posts || [])[0];
    const rest = (posts || []).filter((p: any) => p.id !== hero?.id).slice(0, 29);
    // Mosaic gets the next tier of stories; a dense tail catches the long
    // list so nothing in the brief is lost.
    const mosaicCount = mosaicCols === 3 ? 6 : mosaicCols === 2 ? 6 : 4;
    const mosaicPosts = rest.slice(0, mosaicCount);
    const tailHeadlines = rest.slice(mosaicCount);

    // Curated rails, ranked so the strongest items lead.
    const peopleToFollow = [...(profiles || [])]
      .sort((a: any, b: any) => profileFollowerCount(b) - profileFollowerCount(a))
      .slice(0, 10);
    const activeCommunities = [...(communities || [])]
      .sort((a: any, b: any) =>
        ((b.memberCount || b.member_count || 0) + (b.postCount || b.post_count || 0)) -
        ((a.memberCount || a.member_count || 0) + (a.postCount || a.post_count || 0)))
      .slice(0, 10);
    const topAgents = (agents || []).slice(0, 10);

    const toPost = (p: any) => router.push(`/(tabs)/post/${p.id}` as any);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingBottom: spacing['4xl'] }}>
        {/* Centered measure: the whole page lines up on one column even on a wide monitor. */}
        <View style={{ width: contentWidth }}>
          <TrendingTopicsRow topics={trendingTopics} onPick={goToTopic} gutter={gutter} />

          {/* Lead hero */}
          {hero ? (
            <View style={{ paddingHorizontal: gutter, paddingTop: spacing.sm }}>
              <DiscoverHero post={hero} layout={layout} onPress={() => toPost(hero)} />
            </View>
          ) : null}

          {/* Secondary stories — responsive mosaic */}
          {mosaicPosts.length > 0 ? (
            <>
              <SectionHeader title="Top stories" subtitle="Hand-picked by your agent" gutter={gutter} icon="flash-outline" />
              <MosaicGrid posts={mosaicPosts} cols={mosaicCols} gutter={gutter} onPick={toPost} />
            </>
          ) : null}

          {/* People */}
          {(profilesLoading || peopleToFollow.length > 0) && (
            <>
              <SectionHeader
                title="People to follow"
                subtitle="Voices worth a spot on your feed"
                icon="person-outline"
                gutter={gutter}
                onSeeAll={() => { setActiveTab('people'); router.setParams({ tab: 'people' }); }}
              />
              <HorizontalCarousel loading={profilesLoading && peopleToFollow.length === 0} gutter={gutter}>
                {peopleToFollow.map((person: any) => (
                  <PersonTile
                    key={person.id}
                    person={person}
                    onFollow={() => handleFollow(person.id)}
                    onPress={() => router.push(`/(tabs)/user/${person.username || person.id}` as any)}
                  />
                ))}
              </HorizontalCarousel>
            </>
          )}

          {/* Communities */}
          {(commLoading || activeCommunities.length > 0) && (
            <>
              <SectionHeader
                title="Active communities"
                subtitle="Where the conversation is happening"
                icon="people-outline"
                gutter={gutter}
                onSeeAll={() => { setActiveTab('communities'); router.setParams({ tab: 'communities' }); }}
              />
              <HorizontalCarousel loading={commLoading && activeCommunities.length === 0} gutter={gutter}>
                {activeCommunities.map((community: any) => (
                  <CommunityTile
                    key={community.id}
                    community={community}
                    onPress={() => router.push(`/(tabs)/community/${community.slug || community.id}` as any)}
                  />
                ))}
              </HorizontalCarousel>
            </>
          )}

          {/* Dense tail — more of the brief, fast-scanning rows */}
          {tailHeadlines.length > 0 && (
            <>
              <SectionHeader title="More in today's brief" gutter={gutter} icon="list-outline" />
              <View style={{ borderTopWidth: 0.5, borderTopColor: colors.borderSubtle }}>
                {tailHeadlines.map((p: any) => (
                  <DenseHeadline key={p.id} post={p} gutter={gutter} onPress={() => toPost(p)} />
                ))}
              </View>
            </>
          )}

          {/* Agents */}
          {(agentsLoading || topAgents.length > 0) && (
            <>
              <SectionHeader
                title="Top agents"
                subtitle="Chat with the network's AI minds"
                icon="sparkles-outline"
                gutter={gutter}
                onSeeAll={() => { setActiveTab('agents'); router.setParams({ tab: 'agents' }); }}
              />
              <HorizontalCarousel loading={agentsLoading && topAgents.length === 0} gutter={gutter}>
                {topAgents.map((agent: any) => (
                  <AgentTile
                    key={agent.id}
                    agent={agent}
                    onPress={() => router.push(`/(tabs)/user/${agent.username || agent.id}` as any)}
                  />
                ))}
              </HorizontalCarousel>
            </>
          )}

          <EndOfBrief
            onAsk={async () => {
              if (!sdk) return;
              try {
                const personal = await resolvePersonalAgent(sdk);
                if (!personal) { router.push('/agent' as any); return; }
                const dm = await sdk.chat.dm({ user_id: personal.id, organization_id: ORG_ID || undefined } as any);
                if (dm.data?.id) router.push(`/(tabs)/chat?id=${dm.data.id}` as any);
              } catch {}
            }}
          />
        </View>
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
    if (item.type === 'post') {
      return <PostCard post={item.data} compact />;
    }
    if (item.type === 'person') {
      return (
        <PersonCard
          person={item.data}
          isFollowed={!!followMode}
          onPress={() => router.push(`/(tabs)/user/${item.data.username || item.data.id}` as any)}
          onFollow={() => handleFollow(item.data.id)}
        />
      );
    }
    if (item.type === 'community') {
      return (
        <CommunityCard
          community={item.data}
          onPress={() => router.push(`/(tabs)/community/${item.data.slug || item.data.id}` as any)}
        />
      );
    }
    if (item.type === 'agent') {
      return (
        <AgentCard
          agent={item.data}
          onPress={() => router.push(`/(tabs)/user/${item.data.username || item.data.id}` as any)}
        />
      );
    }
    return null;
  };

  // Show the editorial canvas when we're on the default landing — no
  // search, no follow-list, no explicit tab filter. Once the user types,
  // taps a tab via "See all", or navigates here as a followers list,
  // fall through to the existing tab + list shape.
  const showCanvas = !isSearching && !followMode && !params.tab;

  return (
    <Container safeTop padded={false}>
      <View style={{ backgroundColor: colors.bg, zIndex: 1 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.md,
            borderBottomWidth: 0.5,
            borderBottomColor: colors.borderSubtle,
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
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 0.5,
              borderColor: colors.glassBorder,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              placeholder="Search posts, people, communities, agents..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              style={{
                flex: 1,
                color: colors.text,
                ...typography.body,
                paddingVertical: 10,
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

      {showCanvas ? (
        renderCanvas()
      ) : loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          {[1, 2, 3, 4, 5].map(i => (
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
                      : `${items.length} agents you can chat with`
                    }
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
    </Container>
  );
}
