import { View, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../lib/auth';
import { Container, Text, Button, Card } from '../components';
import { colors, spacing } from '../constants/theme';

const FEATURES = [
  {
    icon: 'sparkles' as const,
    title: 'AI Agents',
    description: 'Chat with intelligent agents that learn and evolve with the community.',
  },
  {
    icon: 'diamond' as const,
    title: 'Token Economy',
    description: 'Earn and spend MINDS tokens. Boost your content. Tip creators you love.',
  },
  {
    icon: 'megaphone' as const,
    title: 'Free Expression',
    description: 'An open network built on transparency, not censorship. Your voice matters.',
  },
];

export default function LandingScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  if (isAuthenticated && !isLoading) {
    router.replace('/(tabs)');
    return null;
  }

  return (
    <Container centered>
      <ScrollView
        contentContainerStyle={{
          alignItems: 'center',
          paddingVertical: spacing['6xl'],
          paddingHorizontal: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', maxWidth: 440, width: '100%' }}>
          {/* Subtle glow */}
          {Platform.OS === 'web' ? (
            <View
              style={{
                position: 'absolute',
                top: -120,
                width: 300,
                height: 300,
                borderRadius: 9999,
                backgroundColor: colors.accent,
                opacity: 0.08,
                ...(Platform.OS === 'web' ? { filter: 'blur(100px)' } as any : {}),
              }}
            />
          ) : null}

          {/* Wordmark */}
          <Text
            variant="hero"
            color={colors.accent}
            align="center"
            style={{
              fontSize: 48,
              letterSpacing: -2,
              fontWeight: '700',
              marginBottom: spacing.xl,
            }}
          >
            minds
          </Text>

          {/* Hero */}
          <Text
            variant="h1"
            align="center"
            style={{ marginBottom: spacing.md, fontSize: 32 }}
          >
            The open social network
          </Text>

          <Text
            variant="body"
            color={colors.textSecondary}
            align="center"
            style={{ marginBottom: spacing['4xl'], maxWidth: 360 }}
          >
            Powered by AI. Owned by you.
          </Text>

          {/* CTAs */}
          <Button
            onPress={() => router.push('/(auth)/sign-up')}
            size="lg"
            fullWidth
          >
            Get Started
          </Button>

          <View style={{ height: spacing.md }} />

          <Button
            onPress={() => router.push('/(auth)/sign-in')}
            variant="ghost"
            size="md"
          >
            Already have an account? Sign In
          </Button>

          {/* Features */}
          <View style={{ marginTop: spacing['5xl'], gap: spacing.lg, width: '100%' }}>
            {FEATURES.map((feature) => (
              <Card key={feature.title} variant="raised">
                <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'flex-start' }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.accent + '18',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={feature.icon} size={20} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="h3" style={{ marginBottom: spacing.xs }}>
                      {feature.title}
                    </Text>
                    <Text variant="body" color={colors.textSecondary}>
                      {feature.description}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {/* Footer */}
          <Text
            variant="caption"
            color={colors.textMuted}
            align="center"
            style={{ marginTop: spacing['4xl'] }}
          >
            Minds 2.0 - Built with Recursiv
          </Text>
        </View>
      </ScrollView>
    </Container>
  );
}
