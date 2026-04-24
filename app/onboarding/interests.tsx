import * as React from 'react';
import { View, ScrollView, Pressable, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { Button } from '../../components/Button';
import { useOnboarding, MINDS_INTERESTS } from '../../lib/onboarding';
import { colors, spacing, radius, typography } from '../../constants/theme';

export default function InterestsScreen() {
  const router = useRouter();
  const { state, update } = useOnboarding();

  const toggle = (key: string) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
    const next = state.interests.includes(key)
      ? state.interests.filter((k) => k !== key)
      : [...state.interests, key];
    update({ interests: next });
  };

  const canContinue = state.interests.length >= 1;

  const handleContinue = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/onboarding/vibe');
  };

  return (
    <Container safeTop safeBottom padded>
      <View style={{ paddingTop: spacing['2xl'], paddingBottom: spacing.lg }}>
        <Text variant="h2" align="center" style={{ marginBottom: spacing.md }}>
          What are you curious about?
        </Text>
        <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 340, alignSelf: 'center', lineHeight: 22 }}>
          Pick whatever feels right. Your agent will tune to it.
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl }}>
          {MINDS_INTERESTS.map(({ key, label }) => {
            const selected = state.interests.includes(key);
            return (
              <Pressable
                key={key}
                onPress={() => toggle(key)}
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
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.xs }}>
          ANYTHING SPECIFIC?
        </Text>
        <TextInput
          value={state.freeTextInterests}
          onChangeText={(t) => update({ freeTextInterests: t })}
          placeholder="Topics, people, publications, whatever."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={200}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            color: colors.text,
            fontSize: typography.body.fontSize,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            minHeight: 80,
            textAlignVertical: 'top',
            marginBottom: spacing.xl,
          }}
        />
      </ScrollView>

      <View style={{ paddingBottom: spacing.xl }}>
        <Button onPress={handleContinue} fullWidth size="lg" disabled={!canContinue}>
          Continue
        </Button>
      </View>
    </Container>
  );
}
