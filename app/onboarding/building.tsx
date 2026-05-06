import * as React from 'react';
import { View, Animated, Easing, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { useOnboarding, markOnboardingComplete, savePreferences, markCuratedNow } from '../../lib/onboarding';
import { useAuth } from '../../lib/auth';
import { buildCuratorRequest, MINDS_PERSONAL_AGENT_SYSTEM_PROMPT } from '../../lib/curator';
import { getPreference } from '../../lib/preferences';
import { spacing } from '../../constants/theme';
import { useColors } from '../../lib/theme';

const STATUS_LINES = [
  'Reading your interests',
  'Scanning sources',
  'Pulling from connections',
  'Scoring relevance',
  'Almost there',
];

/**
 * The agent's first message to a brand-new user. Sent ONCE per user
 * after their first onboarding completes. The chat thread is then
 * silent until the user types — no proactive narration after this.
 *
 * Edit the wording here to change the agent's first impression.
 */
const INTRO_DM_TEMPLATE = [
  "Hey {{username}}, I'm your personal AI agent on Minds.",
  '',
  'I curate your "For You" feed by learning your preferences and finding you the best content across Minds and the full internet each day.',
  '',
  'I can perform scheduled tasks or reminders, help you write new posts, answer questions about Minds, teach you about your engagement patterns, or talk about anything you want really.',
  '',
  "Our conversation is private between us and doesn't train any models. You can give me a name, choose any model and change my personality to whatever you want. You are free to disable me in settings at any time.",
  '',
  "Let me know where you'd like to start.",
].join('\n');

/** Pull a friendly first-name from a display name. Falls back to "there". */
function firstName(name: string | null | undefined): string {
  if (!name) return 'there';
  const first = name.trim().split(/\s+/)[0];
  return first || 'there';
}

export default function BuildingScreen() {
  const router = useRouter();
  const { state } = useOnboarding();
  const { sdk, user } = useAuth();
  const colors = useColors();
  const [statusIndex, setStatusIndex] = React.useState(0);
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const id = setInterval(() => {
      setStatusIndex((i) => Math.min(i + 1, STATUS_LINES.length - 1));
    }, 2500);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseAnim]);

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

        // Build the curator request once. We send it as a one-shot
        // run AND store it as the daily_curate config so the server's
        // background worker can re-run it every morning and push the
        // user "5 new picks" without any client-side cron.
        const curatorRequest = buildCuratorRequest({
          agentName: state.agentName || undefined,
          interests: state.interests,
          vibes: state.vibes,
          persona: state.persona as any,
          pasteSources: state.pasteSources as any,
        });

        await savePreferences({
          ...mindsPreferences,
          paste_sources: state.pasteSources as any,
        });

        if (!getPreference('aiEnabled')) {
          await new Promise((r) => setTimeout(r, 1200));
          if (cancelled) return;
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await markOnboardingComplete();
          router.replace('/(tabs)');
          return;
        }

        const ensured = await (sdk as any)?.agents?.ensurePersonal?.({
          preferences: {
            ...mindsPreferences,
            daily_curate: {
              sources: curatorRequest.sources,
              prompt: curatorRequest.prompt,
              target_size: curatorRequest.target_size ?? 12,
            },
          },
          overrides: {
            name: state.agentName || undefined,
            system_prompt: MINDS_PERSONAL_AGENT_SYSTEM_PROMPT,
          },
        });
        const agentId: string | undefined = ensured?.data?.agent_id;

        const runCurator = (sdk as any)?.curator?.run;
        if (typeof runCurator === 'function') {
          await runCurator.call((sdk as any).curator, curatorRequest);
          await markCuratedNow();
        }

        // One-time intro DM. Sent once per user, ever — by guarding on
        // the agent DM thread being empty. After this the agent stays
        // quiet until the user types.
        if (agentId) {
          try {
            const dmRes = await (sdk as any)?.chat?.dm?.({ user_id: agentId });
            const conversationId: string | undefined = dmRes?.data?.id;
            if (conversationId) {
              const existing = await (sdk as any)?.chat?.messages?.(conversationId, { limit: 1 });
              const isEmpty = !existing?.data || existing.data.length === 0;
              if (isEmpty) {
                const introBody = INTRO_DM_TEMPLATE.replace('{{username}}', firstName(user?.name));
                await (sdk as any)?.chat?.sendAsAgent?.({
                  agent_id: agentId,
                  conversation_id: conversationId,
                  content: introBody,
                });
              }
            }
          } catch {
            // Intro-DM failure is non-fatal — onboarding still completes.
          }
        }
      } catch {
        // Bootstrap blip is non-fatal for onboarding completion.
      }

      const elapsed = Date.now() - start;
      const minDuration = 12_000;
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
          <Text variant="h2" align="center">Building your feed</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320 }}>
            {STATUS_LINES[statusIndex]}…
          </Text>
        </View>
      </View>
    </Container>
  );
}
