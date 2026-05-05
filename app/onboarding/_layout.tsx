import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../lib/onboarding';
import { colors } from '../../constants/theme';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="agent" />
        <Stack.Screen name="interests" />
        <Stack.Screen name="vibe" />
        <Stack.Screen name="connect" />
        <Stack.Screen name="building" />
      </Stack>
    </OnboardingProvider>
  );
}
