import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Text } from '../../components/Text';
import { Container } from '../../components/Container';
import { Button } from '../../components/Button';
import { colors, spacing } from '../../constants/theme';

export default function WelcomeScreen() {
  const router = useRouter();

  const handleStart = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/onboarding/agent');
  };

  return (
    <Container safeTop safeBottom padded centered>
      <View style={{ flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: spacing['4xl'] }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.xl }}>
          <Text variant="h1" color={colors.accent} align="center" style={{ letterSpacing: 8, fontSize: 36 }}>
            minds
          </Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 320, lineHeight: 24 }}>
            Your network, your AI, your feed.
          </Text>
        </View>
        <View style={{ width: '100%', maxWidth: 320 }}>
          <Button onPress={handleStart} fullWidth size="lg">
            Get started
          </Button>
        </View>
      </View>
    </Container>
  );
}
