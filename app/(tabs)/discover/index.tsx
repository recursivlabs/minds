import * as React from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Skeleton } from '../../../components';
import { usePosts, useCommunities, useAgents, useProfiles } from '../../../lib/hooks';
import { useAuth } from '../../../lib/auth';
import { spacing, radius } from '../../../constants/theme';
import { useColors } from '../../../lib/theme';
import { profileFollowerCount } from '../../../lib/models';
import {
  computeLayout,
  computeTrendingTopics,
  engagementScore,
  isRediscoverable,
  communityActivity,
  SectionHeader,
  HorizontalRail,
  RailSkeleton,
  TrendingTopicsRow,
  FeaturedPost,
  PostTile,
  RediscoverTile,
  PersonTile,
  CommunityTile,
  AgentTile,
  POST_TILE_W,
  ENTITY_TILE_W,
  REDISCOVER_TILE_W,
} from '../../../lib/discover';
import { postScore, postReplyCount } from '../../../lib/models';

// ──────────────────────────────────────────────────────────────────────────
// For You master — the curated front door. A live trending-topics rail, then a
// stack of CURATED sections mined from the now-rich network:
//   1. Hot right now      — top posts by real vote score (featured + carousel)
//   2. Voices to follow   — creators ranked by followers
//   3. Communities        — ranked by members + activity
//   4. Talk to an agent    — discoverable AI agents
//   5. Rediscover          — buried gems: high engagement, older posts
//
// Each "See all" deep-links to the matching entity tab. Trending #tags route to
// the Posts tab pre-searched. All ranking is a client-side sort over data the
// existing hooks already load.
// ──────────────────────────────────────────────────────────────────────────

export default function DiscoverForYou() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const colors = useColors();
  const { width: winW } = useWindowDimensions();
  const [canvasW, setCanvasW] = React.useState(0);
  const layout = React.useMemo(() => computeLayout(canvasW || Math.min(Math.max(winW - 256, 320), 1040)), [canvasW, winW]);
  const { gutter } = layout;

  const { sdk } = useAuth();

  // A query typed into the shared search box while on the master "switches
  // entity type" by forwarding to the Posts tab pre-searched (the default
  // entity). Keeps the master a pure curated surface.
  React.useEffect(() => {
    const q = (params.q || '').trim();
    if (q) router.replace({ pathname: '/(tabs)/discover/posts', params: { q } } as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.q]);

  // Discover is the front page of network content — always the score-ranked
  // network feed, never the per-user AI-curated stream.
  const { posts, loading: postsLoading } = usePosts('score', 40);
  const { communities, loading: commLoading } = useCommunities(50);
  const { agents, loading: agentsLoading } = useAgents(50);
  const { profiles, loading: profilesLoading } = useProfiles(50);

  const handleFollow = async (userId: string) => {
    if (!sdk) return;
    try { await sdk.profiles.follow(userId); } catch {}
  };

  const goToTopic = React.useCallback((tag: string) => {
    router.push({ pathname: '/(tabs)/discover/posts', params: { q: `#${tag}` } } as any);
  }, [router]);

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
    () => [...(communities || [])].sort((a, b) => communityActivity(b) - communityActivity(a)).slice(0, 12),
    [communities],
  );
  const topAgents = React.useMemo(() => (agents || []).slice(0, 12), [agents]);

  const toPost = (p: any) => router.push(`/(tabs)/post/${p.id}` as any);
  const toUser = (u: any) => router.push(`/(tabs)/user/${u.username || u.id}` as any);
  const toCommunity = (c: any) => router.push(`/(tabs)/community/${c.slug || c.id}` as any);

  const firstLoad = postsLoading && (posts || []).length === 0;

  const body = () => {
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
        {/* Trending topics — live hashtag pulse into the Posts tab */}
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
              onSeeAll={() => router.push('/(tabs)/discover/posts' as any)}
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
            <SectionHeader title="Voices to follow" subtitle="Creators with a following on Minds" icon="people-outline" gutter={gutter} onSeeAll={() => router.push('/(tabs)/discover/people' as any)} />
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
            <SectionHeader title="Communities to join" subtitle="Where the conversations are happening" icon="people" gutter={gutter} onSeeAll={() => router.push('/(tabs)/discover/communities' as any)} />
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
            <SectionHeader title="Talk to an agent" subtitle="AI you can chat with, right here" icon="sparkles" gutter={gutter} onSeeAll={() => router.push('/(tabs)/discover/agents' as any)} />
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

  return (
    <View
      style={{ flex: 1 }}
      onLayout={(e) => { const w = e.nativeEvent.layout.width; if (w && Math.abs(w - canvasW) > 1) setCanvasW(w); }}
    >
      {body()}
    </View>
  );
}
