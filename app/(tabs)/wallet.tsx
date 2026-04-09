import * as React from 'react';
import { View, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { colors, spacing, radius, typography } from '../../constants/theme';

export default function WalletScreen() {
  const { sdk } = useAuth();
  const [wallet, setWallet] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [sendTo, setSendTo] = React.useState('');
  const [sendAmount, setSendAmount] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!sdk) return;
    (async () => {
      try {
        const res = await sdk.wallet.getMyWallet();
        setWallet(res.data);
      } catch {}
      setLoading(false);
    })();
  }, [sdk]);

  const handleSend = async () => {
    if (!sdk || !sendTo.trim() || !sendAmount.trim()) return;
    setSending(true);
    try {
      await sdk.wallet.send(sendTo.trim(), sendAmount.trim());
      Alert.alert('Success', `Sent ${sendAmount} ETH`);
      setSendTo('');
      setSendAmount('');
      // Refresh balance
      const res = await sdk.wallet.getBalance();
      if (res.data) setWallet((prev: any) => ({ ...prev, ...res.data }));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to send');
    }
    setSending(false);
  };

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Wallet" />

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          <Skeleton height={120} />
          <Skeleton height={80} />
        </View>
      ) : !wallet?.configured ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['3xl'], gap: spacing['2xl'] }}>
          <Ionicons name="wallet-outline" size={40} color={colors.accent} />
          <Text variant="h2" color={colors.text} align="center">Wallet</Text>
          <Text variant="body" color={colors.textSecondary} align="center" style={{ maxWidth: 300, lineHeight: 24 }}>
            A new token economy is coming to Minds.{'\n'}
            Earn, spend, and support the creators you believe in.
          </Text>
          <Text variant="caption" color={colors.textMuted}>Wallet system is being configured</Text>
        </View>
      ) : (
        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          {/* Balance card */}
          <Card>
            <Text variant="caption" color={colors.textMuted}>Your Balance</Text>
            <Text variant="h1" color={colors.accent} style={{ marginTop: spacing.sm }}>
              {wallet.balance || '0'} ETH
            </Text>
            {wallet.address && (
              <View style={{ marginTop: spacing.md }}>
                <Text variant="caption" color={colors.textMuted}>Address</Text>
                <Text variant="mono" color={colors.textSecondary} style={{ fontSize: 12, marginTop: spacing.xs }} selectable numberOfLines={1}>
                  {wallet.address}
                </Text>
              </View>
            )}
          </Card>

          {/* Send */}
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>Send</Text>
            <TextInput
              placeholder="Recipient address (0x...)"
              placeholderTextColor={colors.textMuted}
              value={sendTo}
              onChangeText={setSendTo}
              autoCapitalize="none"
              style={{
                backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder,
                borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10,
                color: colors.text, ...typography.body, marginBottom: spacing.md,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            <TextInput
              placeholder="Amount (ETH)"
              placeholderTextColor={colors.textMuted}
              value={sendAmount}
              onChangeText={setSendAmount}
              keyboardType="decimal-pad"
              style={{
                backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.glassBorder,
                borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 10,
                color: colors.text, ...typography.body, marginBottom: spacing.md,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />
            <Button onPress={handleSend} loading={sending} disabled={!sendTo.trim() || !sendAmount.trim()} size="sm">
              Send
            </Button>
          </Card>

          {/* Token info */}
          <Card>
            <Text variant="label" color={colors.textMuted} style={{ marginBottom: spacing.md }}>MINDS Token</Text>
            <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>
              MINDS tokens power the network economy. Earn by contributing quality content, spend to boost your posts, and tip creators you support.
            </Text>
          </Card>
        </View>
      )}
    </Container>
  );
}
