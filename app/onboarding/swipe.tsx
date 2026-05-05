import * as React from 'react';
import { View, ActivityIndicator, Pressable, Image, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { Button } from '../../components/Button';
import { useAuth } from '../../lib/auth';
import { BASE_URL } from '../../lib/recursiv';
import { useOnboarding } from '../../lib/onboarding';
import { spacing, radius } from '../../constants/theme';
import { useColors } from '../../lib/theme';

interface SeedCard {
  id: string;
  title: string;
  content: string;
  external_url: string;
  source_name: string;
  published_at: string | null;
}

const TARGET_COUNT = 30;
const MIN_BEFORE_CTA = 10;
const SWIPE_THRESHOLD_RATIO = 0.32;

/**
 * Map seed-deck source_name back to one of the 24 MINDS_INTERESTS keys.
 * Falls back to 'tech' for the unmatched RSS feeds in the seed pool.
 */
const SOURCE_TO_INTEREST: Record<string, string> = {
  'Stratechery': 'tech',
  'Anthropic': 'ai',
  'Simon Willison': 'ai',
  'The Gradient': 'ai',
  'Ars Technica': 'tech',
  'Quanta': 'science',
  'Aeon': 'philosophy',
  'HN Best': 'tech',
  'Marginal Revolution': 'finance',
  'The Verge': 'tech',
  'Trending Web': 'culture',
  'Long Reads': 'culture',
  'Science': 'science',
  'Minds': 'culture',
};

function inferInterest(sourceName: string): string {
  if (SOURCE_TO_INTEREST[sourceName]) return SOURCE_TO_INTEREST[sourceName];
  for (const [key, val] of Object.entries(SOURCE_TO_INTEREST)) {
    if (sourceName.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return 'tech';
}

export default function SwipeOnboardingScreen() {
  const router = useRouter();
  const { sdk } = useAuth();
  const { update } = useOnboarding();
  const colors = useColors();

  const [cards, setCards] = React.useState<SeedCard[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [index, setIndex] = React.useState(0);
  const positives = React.useRef<string[]>([]);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  // Fetch the seed deck on mount.
  React.useEffect(() => {
    if (!sdk) return;
    let cancelled = false;
    (async () => {
      try {
        const apiKey = (sdk as any)?.apiKey || (sdk as any)?.config?.apiKey;
        const res = await fetch(`${BASE_URL}/curator/seed-deck?count=${TARGET_COUNT}`, {
          headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        });
        if (!res.ok) throw new Error(`seed-deck ${res.status}`);
        const json = await res.json();
        if (cancelled) return;
        const items: SeedCard[] = (json.data || []).filter((c: SeedCard) => c.title && c.external_url);
        if (items.length === 0) throw new Error('Empty seed deck');
        setCards(items);
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message || 'Could not load deck');
      }
    })();
    return () => { cancelled = true; };
  }, [sdk]);

  const finish = React.useCallback(() => {
    const tally = new Map<string, number>();
    for (const src of positives.current) {
      const k = inferInterest(src);
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    const ordered = [...tally.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    const interests = ordered.length > 0 ? ordered.slice(0, 5) : ['tech', 'ai', 'science', 'culture'];

    update({ interests, vibes: ['news', 'deep'], persona: 'curious' });
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace('/onboarding/building');
  }, [router, update]);

  const advance = React.useCallback((liked: boolean, sourceName: string) => {
    if (liked) positives.current.push(sourceName);
    setIndex((i) => {
      const next = i + 1;
      if (next >= (cards?.length ?? TARGET_COUNT)) {
        finish();
        return i;
      }
      return next;
    });
    tx.value = 0;
    ty.value = 0;
  }, [cards, finish, tx, ty]);

  const current = cards && cards[index];
  const next = cards && cards[index + 1];

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(tx.value, [-300, 0, 300], [-12, 0, 12], Extrapolation.CLAMP);
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const likeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [40, 140], [0, 1], Extrapolation.CLAMP),
  }));
  const passOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(tx.value, [-140, -40], [1, 0], Extrapolation.CLAMP),
  }));

  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;
    })
    .onEnd((e) => {
      const width = 360;
      const threshold = width * SWIPE_THRESHOLD_RATIO;
      if (e.translationX > threshold) {
        tx.value = withTiming(width * 1.5, { duration: 220 }, () => {
          runOnJS(advance)(true, current?.source_name ?? '');
        });
      } else if (e.translationX < -threshold) {
        tx.value = withTiming(-width * 1.5, { duration: 220 }, () => {
          runOnJS(advance)(false, current?.source_name ?? '');
        });
      } else {
        tx.value = withSpring(0);
        ty.value = withSpring(0);
      }
    });

  if (error) {
    return (
      <Container safeTop safeBottom padded centered>
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textMuted} />
          <Text variant="body" color={colors.textSecondary} align="center">
            {error}
          </Text>
          <Button onPress={finish}>Skip for now</Button>
        </View>
      </Container>
    );
  }

  if (!cards || !current) {
    return (
      <Container safeTop safeBottom padded centered>
        <View style={{ alignItems: 'center', gap: spacing.lg }}>
          <ActivityIndicator color={colors.accent} />
          <Text variant="body" color={colors.textSecondary}>Loading your starter deck…</Text>
        </View>
      </Container>
    );
  }

  return (
    <Container safeTop safeBottom padded={false} centered={false}>
      <View style={{ paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.xs }}>
        <Text variant="h2" align="center">Tune your feed</Text>
        <Text variant="caption" color={colors.textMuted} align="center">
          Swipe right on what you'd read. Left to skip. {index + 1} of {cards.length}.
        </Text>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xl }}>
        {next && <CardView card={next} colors={colors} dimmed />}
        <GestureDetector gesture={swipeGesture}>
          <Animated.View style={[{ position: 'absolute', width: '100%' }, cardStyle]}>
            <CardView card={current} colors={colors}>
              <Animated.View
                pointerEvents="none"
                style={[{
                  position: 'absolute', top: spacing.lg, right: spacing.lg,
                  paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                  borderRadius: radius.sm,
                  backgroundColor: colors.success,
                }, likeOpacity]}
              >
                <Text variant="caption" color={colors.textInverse} style={{ fontWeight: '700' }}>YES</Text>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[{
                  position: 'absolute', top: spacing.lg, left: spacing.lg,
                  paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                  borderRadius: radius.sm,
                  backgroundColor: colors.error,
                }, passOpacity]}
              >
                <Text variant="caption" color={colors.textInverse} style={{ fontWeight: '700' }}>NO</Text>
              </Animated.View>
            </CardView>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md, alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <Pressable
            onPress={() => advance(false, current.source_name)}
            style={({ pressed }) => ({
              width: 56, height: 56, borderRadius: 28,
              alignItems: 'center', justifyContent: 'center',
              borderWidth: 1, borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceHover : 'transparent',
            })}
          >
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </Pressable>
          <Pressable
            onPress={() => advance(true, current.source_name)}
            style={({ pressed }) => ({
              width: 56, height: 56, borderRadius: 28,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: pressed ? colors.accentHover : colors.accent,
            })}
          >
            <Ionicons name="heart" size={24} color={colors.textOnAccent} />
          </Pressable>
        </View>
        {index >= MIN_BEFORE_CTA && (
          <Pressable onPress={finish} hitSlop={8}>
            <Text variant="caption" color={colors.accent} style={{ fontWeight: '600' }}>
              Show me my feed →
            </Text>
          </Pressable>
        )}
      </View>
    </Container>
  );
}

function CardView({
  card,
  colors,
  dimmed,
  children,
}: {
  card: SeedCard;
  colors: ReturnType<typeof useColors>;
  dimmed?: boolean;
  children?: React.ReactNode;
}) {
  let domain = '';
  try { domain = new URL(card.external_url).hostname.replace('www.', ''); } catch {}

  return (
    <View
      style={{
        width: '100%',
        backgroundColor: colors.surfaceRaised,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        opacity: dimmed ? 0.5 : 1,
        transform: dimmed ? [{ scale: 0.95 }] : undefined,
      }}
    >
      <View style={{ padding: spacing.xl, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="caption" color={colors.accent} style={{ fontWeight: '600', letterSpacing: 0.5 }}>
            {card.source_name.toUpperCase()}
          </Text>
          {domain && (
            <Text variant="caption" color={colors.textMuted}>· {domain}</Text>
          )}
        </View>
        <Text variant="h2" style={{ fontSize: 22, lineHeight: 28 }}>
          {card.title}
        </Text>
        {card.content ? (
          <Text variant="body" color={colors.textSecondary} numberOfLines={6}>
            {card.content}
          </Text>
        ) : null}
        <Pressable onPress={() => Linking.openURL(card.external_url)} hitSlop={8}>
          <Text variant="caption" color={colors.textMuted} style={{ textDecorationLine: 'underline' }}>
            Open source
          </Text>
        </Pressable>
      </View>
      {children}
    </View>
  );
}
