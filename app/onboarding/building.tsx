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

        // Honour the AI-off master toggle. If the user disabled AI in
        // Settings before completing onboarding (or during it via a
        // future "no thanks" path), skip agent provisioning + curator
        // entirely and finish onboarding clean.
        if (!getPreference('aiEnabled')) {
          await new Promise((r) => setTimeout(r, 1500));
          if (cancelled) return;
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          await markOnboardingComplete();
          router.replace('/(tabs)');
          return;
        }

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

        // Pre-create the agent DM so we can pass its conversation_id
        // to the curator. The curator's brief composition will land
        // there as the user's first message from their agent — the
        // first "felt magic" moment.
        let agentDmId: string | undefined;
        if (agentId && (sdk as any)?.chat?.dm) {
          try {
            const dmRes = await (sdk as any).chat.dm({ user_id: agentId });
            agentDmId = dmRes?.data?.id;
          } catch {}
        }

        if (typeof runCurator === 'function') {
          const request: any = buildCuratorRequest({
            agentName: state.agentName || undefined,
            interests: state.interests,
            vibes: state.vibes,
            persona: state.persona as any,
            pasteSources: state.pasteSources as any,
          });
          if (agentDmId) {
            const personaName = (state.persona || 'curious') as string;
            request.post_brief_to = {
              conversation_id: agentDmId,
              prompt_template: [
                `You are ${state.agentName || 'a personal AI agent'}, a personal curator agent on Minds for {{owner_name}}.`,
                `Your voice is ${personaName}.`,
                '',
                `This is your VERY FIRST message to {{owner_name}}. Greet them warmly and briefly (1 short sentence). Then in 2-3 sentences total, introduce what you just found for them — reference the most interesting 1-2 items by what they're about (not the URLs). End with one inviting question. Plain prose. No bullet lists. No "I hope this finds you well." No preamble. First-person.`,
                '',
                'You just curated these items for them:',
                '{{posts}}',
              ].join('\n'),
              max_items: 3,
            };
          }
          await runCurator.call((sdk as any).curator, request);
          await markCuratedNow();
        } else if (typeof ensurePersonal !== 'function') {
          // Backend not deployed yet — wait the natural 25 seconds so
          // the loading UI doesn't snap to home instantly.
          await new Promise((r) => setTimeout(r, 25_000));
        }

        // Skip the basic welcome message — the curator brief above is
        // the agent's first message now. (Kept this guard intact in
        // case the brief failed.)
        if (agentId && agentDmId === undefined && (sdk as any)?.chat?.dm) {
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
