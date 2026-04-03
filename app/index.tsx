import { View, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth';
import { Text, Button } from '../components';
import { colors, spacing } from '../constants/theme';

export default function LandingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  if (isAuthenticated && !isLoading) {
    router.replace('/(tabs)');
    return null;
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: spacing['2xl'],
      }}
    >
      {/* Glow */}
      {Platform.OS === 'web' ? (
        <View
          style={{
            position: 'absolute',
            width: 500,
            height: 500,
            borderRadius: 9999,
            backgroundColor: colors.accent,
            opacity: 0.04,
            ...(Platform.OS === 'web' ? { filter: 'blur(150px)' } as any : {}),
          }}
        />
      ) : null}

      {/* Wordmark — one word, massive, gold */}
      <Text
        variant="hero"
        color={colors.accent}
        align="center"
        style={{
          fontSize: 96,
          letterSpacing: 12,
          fontWeight: '300',
          textTransform: 'lowercase',
          marginBottom: spacing['5xl'],
        }}
      >
        minds
      </Text>

      {/* Two buttons, nothing else */}
      <View style={{ width: '100%', maxWidth: 280, gap: spacing.md }}>
        <Button
          onPress={() => router.push('/(auth)/sign-up')}
          size="lg"
          fullWidth
        >
          Sign up
        </Button>

        <Button
          onPress={() => router.push('/(auth)/sign-in')}
          variant="ghost"
          size="lg"
          fullWidth
        >
          Sign in
        </Button>
      </View>
    </View>
  );
}
