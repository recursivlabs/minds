import * as React from 'react';
import { View, Pressable, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { Button } from '../../components/Button';
import { useOnboarding, PERSONAS, VIBES, OnboardingPersona, OnboardingVibe } from '../../lib/onboarding';
import { colors, spacing, radius } from '../../constants/theme';

export default function VibeScreen() {
  const router = useRouter();
  const { state, update } = useOnboarding();

  const toggleVibe = (key: OnboardingVibe) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    const next = state.vibes.includes(key)
      ? state.vibes.filter((k) => k !== key)
      : [...state.vibes, key];
    if (next.length === 0) return; // require at least one
    update({ vibes: next });
  };

  const pickPersona = (key: OnboardingPersona) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    update({ persona: key });
  };

  const handleContinue = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding/connect');
  };

  return (
    <Container safeTop safeBottom padded>
      <View style={{ paddingTop: spacing['2xl'], paddingBottom: spacing.lg }}>
        <Text variant="h2" align="center" style={{ marginBottom: spacing.md }}>
          What's your vibe?
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 340, alignSelf: 'center', lineHeight: 22 }}>
          Set how your agent reads the internet for you.
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: spacing.lg }} showsVerticalScrollIndicator={false}>
        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
          FORMAT
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing['2xl'] }}>
          {VIBES.map(({ key, title }) => {
            const selected = state.vibes.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggleVibe(key)}
                style={{
                  paddingVertical: spacing.sm + 2,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.full,
                  backgroundColor: selected ? colors.accentMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: selected ? colors.accent : colors.borderSubtle,
                }}
              >
                <Text variant="body" color={selected ? colors.accent : colors.text} style={{ fontSize: 14 }}>
                  {title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>
          AGENT VOICE
        </Text>
        <View style={{ gap: spacing.md, marginBottom: spacing.xl }}>
          {PERSONAS.map(({ key, title, description }) => {
            const selected = state.persona === key;
            return (
              <Pressable
                key={key}
                onPress={() => pickPersona(key)}
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: selected ? colors.accentMuted : colors.surface,
                  borderWidth: 1,
                  borderColor: selected ? colors.accent : colors.borderSubtle,
                }}
              >
                <Text variant="bodyMedium" color={selected ? colors.accent : colors.text} style={{ marginBottom: 4 }}>
                  {title}
                </Text>
                <Text variant="caption" color={colors.textSecondary} style={{ lineHeight: 18 }}>
                  {description}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={{ paddingBottom: spacing.xl }}>
        <Button onPress={handleContinue} fullWidth size="lg">
          Continue
        </Button>
      </View>
    </Container>
  );
}
