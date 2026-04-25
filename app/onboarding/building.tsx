import * as React from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { useOnboarding, markOnboardingComplete, savePreferences, markCuratedNow } from '../../lib/onboarding';
import { useAuth } from '../../lib/auth';
import { buildCuratorRequest, MINDS_PERSONAL_AGENT_SYSTEM_PROMPT } from '../../lib/curator';
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
  //   1. agents.ensurePersonal — Recursiv platform primitive, creates
  //      the user's personal agent + stores their preferences.
  //   2. curator.run — Recursiv platform primitive, runs the supplied
  //      sources + prompt and inserts audience-scoped posts. Minds-
  //      specific config (RSS map, persona instructions, system prompt)
  //      is assembled locally via buildCuratorRequest.
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

        await savePreferences({
          ...mindsPreferences,
          paste_sources: state.pasteSources as any,
        });

        const ensurePersonal = (sdk as any)?.agents?.ensurePersonal;
        const runCurator = (sdk as any)?.curator?.run;

        let agentId: string | undefined;
        if (typeof ensurePersonal === 'function') {
          const ensured = await ensurePersonal.call((sdk as any).agents, {
            preferences: mindsPreferences,
            overrides: {
              name: state.agentName || undefined,
              system_prompt: MINDS_PERSONAL_AGENT_SYSTEM_PROMPT,
            },
          });
          agentId = ensured?.data?.agent_id;
        }

        if (typeof runCurator === 'function') {
          const request = buildCuratorRequest({
            agentName: state.agentName || undefined,
            interests: state.interests,
            vibes: state.vibes,
            persona: state.persona as any,
            pasteSources: state.pasteSources as any,
          });
          await runCurator.call((sdk as any).curator, request);
          await markCuratedNow();
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
            await (sdk as any).chat.dm({ user_id: agentId });
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
