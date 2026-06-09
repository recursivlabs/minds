// Feedback board: a votes-ranked feature-request / bug board built entirely on
// the existing community + post + vote primitives. The most-upvoted ideas float
// to the top, which is the roadmap-prioritization signal. Submitting opens the
// normal composer targeted at the Feedback community; voting is the normal post
// vote. Status (Planned / Shipped) rides on post tags the team sets, so there's
// no new data model to maintain.
import * as React from 'react';
import { View, FlatList, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, PostCard, Container } from '../../components';
import { ScreenHeader } from '../../components/ScreenHeader';
import { FeedSkeletons } from '../../components/PostSkeleton';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { captureException } from '../../lib/monitoring';
import { postScore, timestampOf } from '../../lib/models';
import { spacing, radius } from '../../constants/theme';
import { useColors } from '../../lib/theme';

const FEEDBACK_SLUG = 'feedback';
type Tab = 'top' | 'new';

export default function FeedbackScreen() {
  const { sdk } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const [community, setCommunity] = React.useState<{ id: string; name: string } | null>(null);
  const [posts, setPosts] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>('top');

  // Resolve the Feedback community by slug (env-agnostic, no hard-coded id).
  React.useEffect(() => {
    if (!sdk) return;
    let active = true;
    (async () => {
      try {
        const list = (await sdk.communities.list({ limit: 100 })).data || [];
        const fb = list.find((c: any) => c.slug === FEEDBACK_SLUG || /^feedback$/i.test(c.name));
        if (active) setCommunity(fb ? { id: fb.id, name: fb.name || 'Feedback' } : null);
      } catch (e) {
        if (active) { captureException(e, { screen: 'feedback', step: 'resolve' }); setError(true); setLoading(false); }
      }
    })();
    return () => { active = false; };
  }, [sdk]);

  const load = React.useCallback(async () => {
    if (!sdk || !community) return;
    setLoading(true); setError(false);
    try {
      const res = await sdk.posts.list({ limit: 50, community_id: community.id, organization_id: ORG_ID || undefined } as any);
      setPosts(res.data || []);
    } catch (e) {
      captureException(e, { screen: 'feedback', step: 'load' });
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [sdk, community]);
  React.useEffect(() => { if (community) load(); }, [community, load]);

  const sorted = React.useMemo(() => {
    const arr = [...posts];
    if (tab === 'top') arr.sort((a, b) => postScore(b) - postScore(a));
    else arr.sort((a, b) => new Date(timestampOf(b)).getTime() - new Date(timestampOf(a)).getTime());
    return arr;
  }, [posts, tab]);

  const submit = () => router.push({
    pathname: '/(tabs)/create',
    params: community ? { communityId: community.id, communityName: community.name } : {},
  } as any);

  const TabBtn = ({ k, label }: { k: Tab; label: string }) => (
    <Pressable onPress={() => setTab(k)} style={{ paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.full, backgroundColor: tab === k ? colors.accentMuted : 'transparent' }}>
      <Text variant="bodyMedium" color={tab === k ? colors.accent : colors.textMuted}>{label}</Text>
    </Pressable>
  );

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Feedback" />
      <View style={{ flex: 1, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
        <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.md, gap: spacing.md }}>
          <Text variant="caption" color={colors.textMuted} style={{ lineHeight: 18 }}>
            Request features, report problems, and upvote what matters. The most-upvoted ideas shape the roadmap.
          </Text>
          <Pressable
            onPress={submit}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md, borderRadius: radius.full, backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 })}
          >
            <Ionicons name="bulb-outline" size={18} color={colors.textOnAccent} />
            <Text variant="bodyMedium" color={colors.textOnAccent}>Share an idea or report a problem</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TabBtn k="top" label="Top voted" />
            <TabBtn k="new" label="New" />
          </View>
        </View>

        {loading ? (
          <FeedSkeletons count={4} />
        ) : error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing['2xl'] }}>
            <Ionicons name="cloud-offline-outline" size={34} color={colors.textMuted} />
            <Text variant="body" color={colors.textSecondary}>Couldn't load feedback.</Text>
            <Pressable onPress={load} style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.full, backgroundColor: colors.accent }}>
              <Text variant="bodyMedium" color={colors.textOnAccent}>Retry</Text>
            </Pressable>
          </View>
        ) : sorted.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing['2xl'] }}>
            <Ionicons name="bulb-outline" size={36} color={colors.accent} />
            <Text variant="h3" align="center">No ideas yet</Text>
            <Text variant="body" color={colors.textMuted} align="center" style={{ maxWidth: 300, lineHeight: 22 }}>
              Be the first to suggest a feature or report a problem.
            </Text>
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PostCard post={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: spacing['4xl'] }}
          />
        )}
      </View>
    </Container>
  );
}
