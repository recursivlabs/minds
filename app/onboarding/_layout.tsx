import { Stack } from 'expo-router';
import { OnboardingProvider } from '../../lib/onboarding';
import { useColors } from '../../lib/theme';

export default function OnboardingLayout() {
  const colors = useColors();
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
          gestureEnabled: false,
        }}
      >
        <Stack.Screen name="swipe" />
        <Stack.Screen name="building" />
      </Stack>
    </OnboardingProvider>
  );
}
