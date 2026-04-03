import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
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
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ flex: 1 }}>Wallet</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance */}
        <WalletCard balance={0} />

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button onPress={() => {}} variant="secondary" fullWidth>
              Earn
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button onPress={() => {}} variant="secondary" fullWidth>
              Send
            </Button>
          </View>
        </View>

        {/* Recent transactions */}
        <View>
          <Text variant="h3" style={{ marginBottom: spacing.lg }}>
            Recent Transactions
          </Text>
          <Card variant="raised">
            <View style={{ alignItems: 'center', padding: spacing.xl }}>
              <Ionicons name="receipt-outline" size={36} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                No transactions yet
              </Text>
              <Text variant="caption" color={colors.textMuted} align="center" style={{ marginTop: spacing.xs }}>
                Your token transactions will appear here
              </Text>
            </View>
          </Card>
        </View>

        <Divider />

        {/* How to earn */}
        <View>
          <Text variant="h3" style={{ marginBottom: spacing.lg }}>
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
