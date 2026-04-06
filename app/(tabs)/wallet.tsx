import * as React from 'react';
import { View, ScrollView, Pressable, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, WalletCard, Divider, Container } from '../../components';
import { colors, spacing, radius } from '../../constants/theme';

const EARN_METHODS = [
  {
    icon: 'newspaper-outline' as const,
    title: 'Create content',
    description: 'Earn tokens when your posts get upvoted',
  },
  {
    icon: 'people-outline' as const,
    title: 'Grow your audience',
    description: 'Earn tokens when users follow you',
  },
  {
    icon: 'share-outline' as const,
    title: 'Refer friends',
    description: 'Get bonus tokens for each friend who joins',
  },
  {
    icon: 'time-outline' as const,
    title: 'Daily check-in',
    description: 'Login daily to earn a small token reward',
  },
];

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <Container safeTop padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Text variant="bodyMedium" style={{ flex: 1, fontSize: 14 }}>Wallet</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance */}
        <WalletCard balance={0} />

        {/* Token system notice */}
        <View
          style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: radius.md,
            padding: spacing.lg,
            borderWidth: 0.5,
            borderColor: colors.accent + '30',
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
          }}
        >
          <Ionicons name="time-outline" size={20} color={colors.accent} />
          <Text variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
            Token system coming soon. Earn and send MINDS tokens for content and engagement.
          </Text>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => {
                const msg = 'Earning tokens coming soon! Create content and engage to earn MINDS tokens.';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Coming Soon', msg);
              }}
              variant="secondary"
              fullWidth
            >
              Earn
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button
              onPress={() => {
                const msg = 'Sending tokens coming soon! You will be able to tip creators with MINDS tokens.';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Coming Soon', msg);
              }}
              variant="secondary"
              fullWidth
            >
              Send
            </Button>
          </View>
        </View>

        {/* Recent transactions */}
        <View>
          <Text variant="bodyMedium" color={colors.textSecondary} style={{ marginBottom: spacing.lg, fontSize: 14 }}>
            Recent Transactions
          </Text>
          <Card variant="raised">
            <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.md }}>
              <Ionicons name="receipt-outline" size={32} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted}>
                No transactions yet
              </Text>
              <Text variant="caption" color={colors.textMuted} align="center">
                Start posting to earn tokens
              </Text>
              <Button onPress={() => router.push('/(tabs)/create')} size="sm">
                Start posting to earn
              </Button>
            </View>
          </Card>
        </View>

        <Divider />

        {/* How to earn */}
        <View>
          <Text variant="bodyMedium" color={colors.textSecondary} style={{ marginBottom: spacing.lg, fontSize: 14 }}>
            How to Earn Tokens
          </Text>
          <View style={{ gap: spacing.md }}>
            {EARN_METHODS.map((method) => (
              <Card key={method.title}>
                <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      backgroundColor: colors.tokenMuted,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={method.icon} size={20} color={colors.token} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyMedium">{method.title}</Text>
                    <Text variant="caption" color={colors.textMuted}>{method.description}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </View>

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>
    </Container>
  );
}
