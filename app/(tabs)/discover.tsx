import * as React from 'react';
import { View, FlatList, TextInput, Platform, Pressable, ActivityIndicator, ScrollView } from 'react-native';
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
import { spacing, radius, typography } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { profileFollowerCount } from '../../lib/models';

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

// Topic chips that filter the Discover canvas. Short, opinionated set
// chosen to match the curator's top categories. Adding more = more
// noise; keeping under 8 keeps the row scannable.
const TOPIC_CHIPS: { key: string; label: string; match: RegExp }[] = [
  { key: 'all', label: 'All', match: /.*/ },
  { key: 'ai', label: 'AI', match: /\b(ai|llm|gpt|claude|anthropic|openai|gemini|agent|model|inference)\b/i },
  { key: 'crypto', label: 'Crypto', match: /\b(crypto|bitcoin|btc|eth|sol|defi|wallet|chain|blockchain|stablecoin)\b/i },
  { key: 'tech', label: 'Tech', match: /\b(startup|founder|product|launch|release|app|software|github|api|sdk)\b/i },
  { key: 'science', label: 'Science', match: /\b(research|study|scientist|biology|physics|paper|nature|arxiv|theory)\b/i },
  { key: 'culture', label: 'Culture', match: /\b(film|music|book|art|essay|writer|culture|history|design)\b/i },
  { key: 'world', label: 'World', match: /\b(china|russia|europe|asia|africa|government|election|war|policy)\b/i },
];

function topicMatches(post: any, topicKey: string): boolean {
  const chip = TOPIC_CHIPS.find((c) => c.key === topicKey);
  if (!chip) return true;
  const hay = `${post.title || ''} ${post.content || ''} ${post.tags?.join(' ') || ''}`;
  return chip.match.test(hay);
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
  // Cheap classifier: walks the topic chips in order and picks the
  // first that matches. Fed back into the dense-row eyebrow so each
  // headline reads "AI · TechCrunch" or "CRYPTO · Bloomberg" instead
  // of just a hostname.
  for (const chip of TOPIC_CHIPS) {
    if (chip.key === 'all') continue;
    if (topicMatches(post, chip.key)) return chip.label.toUpperCase();
  }
  return '';
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

function DiscoverHero({ post, onPress }: { post: any; onPress: () => void }) {
  const colors = useColors();
  const image = post.image || post.previewImage;
  const source = postSource(post);
  const category = postCategory(post);
  const take = postAITake(post);
  const replies = post.replyCount || post.reply_count || 0;
  // Hero is in-viewport the moment Discover renders, so log a view
  // signal once per mount per post.
  React.useEffect(() => {
    if (post?.id) logSignal('view', { postId: post.id, metadata: { surface: 'discover_hero' } });
  }, [post?.id]);
  return (
    <Pressable
      onPress={() => { if (post?.id) logSignal('click', { postId: post.id, metadata: { surface: 'discover_hero' } }); onPress(); }}
      style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
    >
      {image ? (
        <View style={{ width: '100%', aspectRatio: 1.91, backgroundColor: colors.surfaceRaised, marginBottom: spacing.lg }}>
          {Platform.OS === 'web'
            ? <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' } as any} />
            : null}
        </View>
      ) : null}
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.sm }}>
        <Text variant="caption" color={colors.accent} style={{ letterSpacing: 1.5, fontSize: 10 }}>
          {category ? `${category} · TODAY` : 'TODAY · MINDS'}
        </Text>
        <Text variant="h1" color={colors.text} style={{ fontWeight: '600', lineHeight: 34 }} numberOfLines={4}>
          {post.title || (post.content || '').split('\n')[0].slice(0, 120)}
        </Text>
        {take ? (
          <Text variant="body" color={colors.textSecondary} style={{ fontStyle: 'italic', lineHeight: 22 }} numberOfLines={3}>
            {take}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm, flexWrap: 'wrap' }}>
          <Text variant="caption" color={colors.textMuted}>{source}</Text>
          {replies > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Ionicons name="chatbubble-outline" size={11} color={colors.textMuted} />
              <Text variant="caption" color={colors.textMuted}>{replies} repl{replies === 1 ? 'y' : 'ies'} on Minds</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' as any }}>
            <Text variant="caption" color={colors.accent}>Discuss →</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function DenseHeadline({ post, onPress }: { post: any; onPress: () => void }) {
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
        paddingHorizontal: spacing.xl,
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

function TopicChipRow({ chips, active, onChange }: { chips: typeof TOPIC_CHIPS; active: string; onChange: (k: string) => void }) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm }}
    >
      {chips.map((c) => {
        const isActive = active === c.key;
        return (
          <Pressable
            key={c.key}
            onPress={() => onChange(c.key)}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: 6,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: isActive ? colors.accent : colors.borderSubtle,
              backgroundColor: isActive ? colors.accentMuted : 'transparent',
              opacity: pressed ? 0.7 : 1,
              marginRight: spacing.sm,
            })}
          >
            <Text variant="caption" color={isActive ? colors.accent : colors.textMuted} style={{ fontSize: 12 }}>
              {c.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
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

const TILE_WIDTH = 220;

function PersonTile({ person, onPress }: { person: any; onPress: () => void }) {
  const colors = useColors();
  const name = person.name || 'Unknown';
  const username = person.username;
  const bio = person.bio || person.description || '';
  const avatar = person.image || person.avatar;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        padding: spacing.lg,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.sm }}>{name}</Text>
      {username && <Text variant="caption" color={colors.textMuted} numberOfLines={1}>@{username}</Text>}
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 18 }}>
          {bio}
        </Text>
      ) : null}
    </Pressable>
  );
}

function CommunityTile({ community, onPress }: { community: any; onPress: () => void }) {
  const colors = useColors();
  const name = community.name || 'Unnamed';
  const description = community.description || community.bio || '';
  const avatar = community.image || community.avatar;
  const memberCount = community.memberCount || community.member_count || 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        padding: spacing.lg,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
      })}
    >
      <Avatar uri={avatar} name={name} size="lg" />
      <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.sm }}>{name}</Text>
      {description ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 18 }}>
          {description}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
        <Ionicons name="people-outline" size={11} color={colors.textMuted} />
        <Text variant="caption" color={colors.textMuted}>{memberCount.toLocaleString()} members</Text>
      </View>
    </Pressable>
  );
}

function AgentTile({ agent, onPress }: { agent: any; onPress: () => void }) {
  const colors = useColors();
  const name = agent.name || 'Agent';
  const bio = agent.bio || agent.description || agent.system_prompt?.slice(0, 120) || '';
  const avatar = agent.image || agent.avatar;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: TILE_WIDTH,
        padding: spacing.lg,
        marginRight: spacing.md,
        backgroundColor: pressed ? colors.surfaceHover : colors.surface,
        borderRadius: radius.lg,
        borderWidth: 0.5,
        borderColor: colors.borderSubtle,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Avatar uri={avatar} name={name} size="lg" />
        <View style={{ backgroundColor: colors.accentMuted, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm }}>
          <Text variant="caption" color={colors.accent} style={{ fontSize: 10 }}>AI</Text>
        </View>
      </View>
      <Text variant="bodyMedium" numberOfLines={1} style={{ marginTop: spacing.sm }}>{name}</Text>
      {bio ? (
        <Text variant="caption" color={colors.textSecondary} numberOfLines={3} style={{ marginTop: spacing.xs, lineHeight: 18 }}>
          {bio}
        </Text>
      ) : null}
      <Text variant="caption" color={colors.accent} style={{ marginTop: spacing.sm }}>Chat now →</Text>
    </Pressable>
  );
}

function SectionHeader({ title, subtitle, onSeeAll }: { title: string; subtitle?: string; onSeeAll?: () => void }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingTop: spacing['2xl'],
        paddingBottom: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text variant="h3">{title}</Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>{subtitle}</Text>
        ) : null}
      </View>
      {onSeeAll ? (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text variant="caption" color={colors.accent}>See all →</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function HorizontalCarousel({ children, loading }: { children: React.ReactNode; loading?: boolean }) {
  const colors = useColors();
  if (loading) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}
      >
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={{
              width: TILE_WIDTH,
              height: 160,
              marginRight: spacing.md,
              borderRadius: radius.lg,
            }}
          >
            <Skeleton width={TILE_WIDTH} height={160} borderRadius={radius.lg} />
          </View>
        ))}
      </ScrollView>
    );
  }
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}
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
  const [activeTab, setActiveTab] = React.useState<DiscoverTab>(
    (params.tab as DiscoverTab) || 'posts'
  );
  const [searchQuery, setSearchQuery] = React.useState(params.q || '');
  const [activeTopic, setActiveTopic] = React.useState<string>('all');
  const topicChips = React.useMemo(() => TOPIC_CHIPS, []);

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

  const isSearching = searchQuery.trim().length > 0;

  // ── Discover canvas: hero + dense column ──
  // Drudge meets Reddit front page meets your AI's editorial brief.
  // Hero gets full visual treatment when the top pick has an OG image;
  // dense column below scrolls fast with source bylines, AI takes, and
  // reply counts. Topic chips at top filter the whole canvas.
  const renderCanvas = () => {
    if (postsLoading && (posts || []).length === 0) {
      return (
        <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, gap: spacing.lg }}>
          <Skeleton width="100%" height={240} borderRadius={radius.lg} />
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View key={i} style={{ gap: spacing.xs }}>
              <Skeleton width={100} height={10} />
              <Skeleton width="100%" height={18} />
            </View>
          ))}
        </View>
      );
    }
    if ((posts || []).length === 0) {
      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="newspaper-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">Your agent is warming up</Text>
          <Text variant="body" color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 320, lineHeight: 24 }}>
            Set up your personal AI agent and it'll surface the day's reading list here, curated to your taste.
          </Text>
          <Button onPress={() => router.push('/agent' as any)} size="sm">Set up agent</Button>
        </View>
      );
    }
    // Filtered set drives both hero pick and dense column. When the
    // user selects a topic chip, both update together.
    const filtered = activeTopic
      ? (posts || []).filter((p: any) => topicMatches(p, activeTopic))
      : (posts || []);
    const hero = filtered.find((p: any) => p.image || p.previewImage) || filtered[0];
    const dense = filtered.filter((p: any) => p.id !== hero?.id).slice(0, 29);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: spacing['3xl'] }}>
        <TopicChipRow active={activeTopic} onChange={setActiveTopic} chips={topicChips} />
        {hero && <DiscoverHero post={hero} onPress={() => router.push(`/(tabs)/post/${hero.id}` as any)} />}
        <View style={{ height: 1, backgroundColor: colors.borderSubtle, marginTop: spacing.lg }} />
        {dense.map((p: any) => (
          <DenseHeadline
            key={p.id}
            post={p}
            onPress={() => router.push(`/(tabs)/post/${p.id}` as any)}
          />
        ))}
        <EndOfBrief
          onAsk={async () => {
            if (!sdk) return;
            try {
              const list = await sdk.agents.list({ limit: 50 });
              const personal = (list.data || []).find((a: any) => a.agent_type === 'personal' || a.agentType === 'personal');
              if (!personal) { router.push('/agent' as any); return; }
              const dm = await sdk.chat.dm({ user_id: personal.id, organization_id: ORG_ID || undefined } as any);
              if (dm.data?.id) router.push(`/(tabs)/chat?id=${dm.data.id}` as any);
            } catch {}
          }}
        />
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
