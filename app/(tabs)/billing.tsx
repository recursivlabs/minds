import * as React from 'react';
import { View, ScrollView, Pressable, Platform, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { ORG_ID } from '../../lib/recursiv';
import { colors, spacing } from '../../constants/theme';

export default function BillingScreen() {
  const router = useRouter();
  const { sdk } = useAuth();

  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<any>(null);
  const [usage, setUsage] = React.useState<any>(null);
  const [error, setError] = React.useState(false);
  const [portalLoading, setPortalLoading] = React.useState(false);

  React.useEffect(() => {
    if (!sdk) return;
    (async () => {
      setLoading(true);
      try {
        const [s, u] = await Promise.all([
          sdk.billing.getStatus({ owner_type: 'organization', owner_id: ORG_ID }).catch(() => null),
          sdk.billing.getUsage({ owner_type: 'organization', owner_id: ORG_ID }).catch(() => null),
        ]);
        setStatus(s);
        setUsage(u);
      } catch {
        setError(true);
      }
      setLoading(false);
    })();
  }, [sdk]);

  const openPortal = async () => {
    if (!sdk) return;
    setPortalLoading(true);
    try {
      const returnUrl = Platform.OS === 'web' ? window.location.href : 'minds://billing';
      const result = await sdk.billing.createPortalSession({
        owner_type: 'organization',
        owner_id: ORG_ID,
        return_url: returnUrl,
      });
      const url = result?.url || result;
      if (url && typeof url === 'string') {
        if (Platform.OS === 'web') window.open(url, '_blank');
        else Linking.openURL(url);
      }
    } catch {
      import('react-native').then(rn => rn.Alert.alert('Error', 'Could not open billing portal.'));
    }
    setPortalLoading(false);
  };

  if (loading) {
    return (
      <Container safeTop>
        <View style={{ paddingTop: spacing['3xl'], gap: spacing.xl, paddingHorizontal: spacing.xl }}>
          <Skeleton height={100} />
          <Skeleton height={80} />
        </View>
      </Container>
    );
  }

  if (error || (!status && !usage)) {
    return (
      <Container safeTop padded={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 0.5, borderBottomColor: colors.borderSubtle }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1 }}>Billing</Text>
        </View>
        <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.lg }}>
          <Ionicons name="card-outline" size={40} color={colors.textMuted} />
          <Text variant="h3" color={colors.textSecondary} align="center">Billing coming soon</Text>
          <Text variant="body" color={colors.textMuted} align="center" style={{ maxWidth: 280 }}>
            Subscription management and usage tracking will be available here.
          </Text>
        </View>
      </Container>
    );
  }

  const planName = status?.plan?.name || status?.planName || 'Free';
  const planStatus = status?.status || status?.subscriptionStatus || 'active';
  const usageItems = usage?.items || usage?.usage || [];

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Billing" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.sm }}>Current Plan</Text>
          <Text variant="h2" color={colors.accent}>{planName}</Text>
          <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            Status: {planStatus}
          </Text>
          <View style={{ marginTop: spacing.lg }}>
            <Button onPress={openPortal} loading={portalLoading} variant="secondary" size="sm">Manage Subscription</Button>
          </View>
        </Card>

        <Card>
          <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Usage</Text>
          {Array.isArray(usageItems) && usageItems.length > 0 ? (
            usageItems.map((item: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.xs }}>
                <Text variant="body">{item.name || item.label || item.metric || 'Usage'}</Text>
                <Text variant="bodyMedium" color={colors.accent}>
                  {item.value ?? item.used ?? item.count ?? 0}{item.limit ? ` / ${item.limit}` : ''}
                </Text>
              </View>
            ))
          ) : (
            <Text variant="caption" color={colors.textMuted}>No usage data available yet.</Text>
          )}
        </Card>
      </ScrollView>
    </Container>
  );
}
