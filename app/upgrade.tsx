import * as React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card } from '../components';
import { Container } from '../components/Container';
import { spacing, radius } from '../constants/theme';
import { useColors } from '../lib/theme';
import { openCheckout, type PaidTier } from '../lib/subscription';

type Plan = {
  tier: PaidTier;
  name: string;
  price: string;
  tagline: string;
  perks: string[];
  highlight?: boolean;
};

const PLANS: Plan[] = [
  {
    tier: 'plus',
    name: 'Plus',
    price: '$9.99',
    tagline: 'For people who want more.',
    perks: [
      'Upload video — up to 25 hours',
      'Unlimited feed refreshes',
      'More daily messages with your agent',
      'Connect YouTube, Spotify, Reddit & more',
    ],
  },
  {
    tier: 'pro',
    name: 'Pro',
    price: '$69.99',
    tagline: 'Everything, unlocked.',
    highlight: true,
    perks: [
      'Everything in Plus',
      '190 hours of video, in 1080p',
      'Multiple AI agents',
      'Premium connections — X, Gmail, Notion',
      'Voice mode & API access',
    ],
  },
];

export default function UpgradeScreen() {
  const router = useRouter();
  const colors = useColors();
  const params = useLocalSearchParams<{ sub?: string; tier?: string }>();

  const [loadingTier, setLoadingTier] = React.useState<PaidTier | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const justSubscribed = params.sub === 'success';

  const onUpgrade = async (tier: PaidTier) => {
    setError(null);
    setLoadingTier(tier);
    try {
      await openCheckout(tier);
      // On web this redirects away; on native the browser opens. Either way,
      // clear the spinner in case the user comes back without completing.
    } catch (e: any) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <Container safeTop padded={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Upgrade</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.lg }}>
        <View style={{ gap: spacing.xs, marginBottom: spacing.sm }}>
          <Text variant="h2">Get more out of Minds</Text>
          <Text variant="body" color={colors.textMuted}>Pick a plan. Cancel anytime.</Text>
        </View>

        {justSubscribed && (
          <View style={{ backgroundColor: colors.successMuted, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text variant="body" color={colors.success} style={{ flex: 1 }}>You're all set. Welcome to {params.tier === 'pro' ? 'Pro' : 'Plus'}.</Text>
          </View>
        )}

        {error && (
          <Pressable onPress={() => setError(null)} style={{ backgroundColor: colors.errorMuted, padding: spacing.md, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="alert-circle" size={18} color={colors.error} />
            <Text variant="body" color={colors.error} style={{ flex: 1 }}>{error}</Text>
          </Pressable>
        )}

        {PLANS.map((plan) => (
          <Card key={plan.tier} style={plan.highlight ? { borderColor: colors.accent, borderWidth: 1 } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text variant="h2">{plan.name}</Text>
              <Text variant="body" color={colors.textMuted}>{plan.price}/mo</Text>
            </View>
            <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs, marginBottom: spacing.md }}>{plan.tagline}</Text>

            <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
              {plan.perks.map((perk, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <Ionicons name="checkmark" size={18} color={colors.accent} style={{ marginTop: 1 }} />
                  <Text variant="body" style={{ flex: 1 }}>{perk}</Text>
                </View>
              ))}
            </View>

            <Button
              onPress={() => onUpgrade(plan.tier)}
              loading={loadingTier === plan.tier}
              disabled={loadingTier !== null}
              variant={plan.highlight ? 'primary' : 'secondary'}
            >
              {`Go ${plan.name}`}
            </Button>
          </Card>
        ))}

        <Text variant="caption" color={colors.textMuted} align="center" style={{ marginTop: spacing.sm }}>
          Payments are handled securely by Stripe.
        </Text>
      </ScrollView>
    </Container>
  );
}
