import * as React from 'react';
import { View, TextInput, Pressable, Platform, ScrollView, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { Button } from '../../components/Button';
import { useOnboarding } from '../../lib/onboarding';
import { colors, spacing, radius, typography } from '../../constants/theme';

const AVATAR_GRADIENTS = [
  ['#d4a844', '#a07a2c'], // gold
  ['#7c84ff', '#3a4ad6'], // indigo
  ['#34d399', '#0e8a5f'], // emerald
  ['#f87171', '#a93030'], // crimson
];

function PresetAvatar({ index, selected, onPress }: { index: number; selected: boolean; onPress: () => void }) {
  const [start, end] = AVATAR_GRADIENTS[index];
  return (
    <Pressable
      onPress={() => {
        if (Platform.OS !== 'web') Haptics.selectionAsync();
        onPress();
      }}
      style={{
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: start,
        borderWidth: selected ? 3 : 0,
        borderColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
        ...(Platform.OS === 'web'
          ? { background: `linear-gradient(135deg, ${start}, ${end})` } as any
          : {}),
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: end,
        }}
      />
    </Pressable>
  );
}

export default function AgentScreen() {
  const router = useRouter();
  const { state, update } = useOnboarding();

  const handleContinue = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding/interests');
  };

  const handleSkip = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    if (!state.agentName.trim()) update({ agentName: 'Agent' });
    router.push('/onboarding/interests');
  };

  return (
    <Container safeTop safeBottom padded>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingTop: spacing['3xl'], paddingBottom: spacing['2xl'] }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={{ alignItems: 'center', marginBottom: spacing['2xl'] }}>
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 48,
              backgroundColor: AVATAR_GRADIENTS[state.agentAvatar][0],
              alignItems: 'center',
              justifyContent: 'center',
              ...(Platform.OS === 'web'
                ? {
                    background: `linear-gradient(135deg, ${AVATAR_GRADIENTS[state.agentAvatar][0]}, ${AVATAR_GRADIENTS[state.agentAvatar][1]})`,
                  } as any
                : {}),
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: AVATAR_GRADIENTS[state.agentAvatar][1],
              }}
            />
          </View>
        </View>

        <Text variant="h2" align="center" style={{ marginBottom: spacing.md }}>
          Meet your agent.
        </Text>
        <Text
          variant="body"
          color={colors.textSecondary}
          align="center"
          style={{ marginBottom: spacing['2xl'], maxWidth: 320, alignSelf: 'center', lineHeight: 22 }}
        >
          This is your AI. It is yours alone. It will curate your feed, and only yours. Your conversations never train anything. It works for you.
        </Text>

        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
          NAME
        </Text>
        <TextInput
          value={state.agentName}
          onChangeText={(t) => update({ agentName: t })}
          placeholder="What should we call your agent?"
          placeholderTextColor={colors.textMuted}
          maxLength={32}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            color: colors.text,
            fontSize: typography.body.fontSize,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            marginBottom: spacing.xl,
          }}
        />

        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
          AVATAR
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.md, marginBottom: spacing['2xl'] }}>
          {AVATAR_GRADIENTS.map((_, i) => (
            <PresetAvatar key={i} index={i} selected={state.agentAvatar === i} onPress={() => update({ agentAvatar: i })} />
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ paddingBottom: spacing.xl, gap: spacing.md }}>
          <Button onPress={handleContinue} fullWidth size="lg" disabled={!state.agentName.trim()}>
            Continue
          </Button>
          <Pressable onPress={handleSkip} hitSlop={12} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
            <Text variant="bodyMedium" color={colors.textMuted}>
              Skip for now
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </Container>
  );
}
