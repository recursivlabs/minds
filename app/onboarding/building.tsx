import * as React from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { useOnboarding, markOnboardingComplete } from '../../lib/onboarding';
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

  // Submit the onboarding payload + bootstrap the feed. Stubbed to a
  // delay for now; once `sdk.agents.bootstrap` lands on the backend
  // this calls it and waits for the curated posts to be created.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const start = Date.now();
      try {
        const bootstrap = (sdk as any)?.agents?.bootstrap;
        if (typeof bootstrap === 'function') {
          await bootstrap.call((sdk as any).agents, {
            preferences: {
              interests: state.interests,
              free_text_interests: state.freeTextInterests,
              vibes: state.vibes,
              persona: state.persona,
              agent_name: state.agentName,
              agent_avatar: state.agentAvatar,
            },
            connections: state.pasteSources,
          });
        } else {
          // Backend bootstrap method not deployed yet — wait the natural
          // 25 seconds so the loading UI doesn't snap to home instantly.
          await new Promise((r) => setTimeout(r, 25_000));
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
