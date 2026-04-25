import * as React from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { useOnboarding, markOnboardingComplete, savePreferences } from '../../lib/onboarding';
import { useAuth } from '../../lib/auth';
import { colors, spacing } from '../../constants/theme';

const STATUS_LINES = [
  'Reading your interests',
  'Scanning sources',
  'Pulling from connections',
  'Scoring relevance',
  'Writing your takes',
  'Almost there',
];

export default function BuildingScreen() {
  const router = useRouter();
  const { state } = useOnboarding();
  const { sdk } = useAuth();
  const [statusIndex, setStatusIndex] = React.useState(0);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // Cycle status line every ~4 seconds.
  React.useEffect(() => {
    const id = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, STATUS_LINES.length - 1));
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // Pulse animation on the avatar.
  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

  // Two-step onboarding completion:
  //   1. agents.ensurePersonal — platform primitive, creates the user's
  //      personal agent (idempotent) and stores their preferences.
  //   2. minds.curateFeed — Minds-specific curator that fetches RSS,
  //      annotates via LLM, and inserts audience-scoped posts.
  // The client stitches them; the server keeps the two concerns clean.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = Date.now();
      try {
        const mindsPreferences = {
          interests: state.interests,
          free_text_interests: state.freeTextInterests,
          vibes: state.vibes,
          persona: state.persona,
          agent_name: state.agentName,
          agent_avatar: state.agentAvatar,
        };

        // Persist preferences so pull-to-refresh on the home feed can
        // re-trigger curation later without sending the user back through
        // onboarding.
        await savePreferences({
          ...mindsPreferences,
          paste_sources: state.pasteSources as any,
        });

        const ensurePersonal = (sdk as any)?.agents?.ensurePersonal;
        const curateFeed = (sdk as any)?.minds?.curateFeed;

        let agentId: string | undefined;
        if (typeof ensurePersonal === 'function') {
          const ensured = await ensurePersonal.call((sdk as any).agents, {
            preferences: mindsPreferences,
            overrides: state.agentName ? { name: state.agentName } : undefined,
          });
          agentId = ensured?.data?.agent_id;
        }

        if (typeof curateFeed === 'function') {
          await curateFeed.call((sdk as any).minds, {
            preferences: mindsPreferences,
            paste_sources: state.pasteSources,
          });
        } else if (typeof ensurePersonal !== 'function') {
          // Backend not deployed yet — wait the natural 25 seconds so
          // the loading UI doesn't snap to home instantly.
          await new Promise((r) => setTimeout(r, 25_000));
        }

        // Seed a DM with the personal agent so the Chat tab has the
        // user's first conversation ready to go. dm() is get-or-create
        // so this is idempotent — re-onboarding won't duplicate it.
        if (agentId && (sdk as any)?.chat?.dm) {
          try {
            await (sdk as any).chat.dm({ recipient_id: agentId });
          } catch {
            // DM-seed blip is non-fatal.
          }
        }
      } catch {
        // Bootstrap blip is non-fatal for onboarding completion.
      }

      const elapsed = Date.now() - start;
      const minDuration = 18_000;
      if (elapsed < minDuration) await new Promise((r) => setTimeout(r, minDuration - elapsed));

      if (cancelled) return;
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await markOnboardingComplete();
      router.replace('/(tabs)');
    })();
    return () => { cancelled = true; };
  }, [router, sdk, state]);

  return (
    <Container safeTop safeBottom padded centered>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing['2xl'] }}>
        <Animated.View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            backgroundColor: colors.accent,
            opacity: 0.4,
            transform: [{ scale: pulseAnim }],
          }}
        />
        <View style={{ alignItems: 'center', gap: spacing.sm }}>
          <Text variant="h2" align="center">
            Building your feed
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320 }}>
            {STATUS_LINES[statusIndex]}…
          </Text>
        </View>
      </View>
    </Container>
  );
}
