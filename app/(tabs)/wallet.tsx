import * as React from 'react';
import { View, TextInput, Platform, Pressable, Modal, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { showToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { spacing, radius, typography, borders } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { captureException } from '../../lib/monitoring';

/**
 * What the SDK actually exposes (packages/sdk/src/resources/wallet.ts):
 *   getMyWallet() -> { configured, address, balance, balance_wei, user_index, is_smart_account }
 *   getBalance()  -> { configured, address, balance, balance_wei }
 *   send(to, amountEth)
 * `balance` is the wallet's on-chain ETH balance (gas), NOT a MINDS token
 * balance — there is no MINDS-token balance, USD value, or transaction-history
 * endpoint. So v1 leads with the real ETH balance (honestly labelled) and
 * presents MINDS as the network token with a "coming soon" treatment rather
 * than fabricating a number.
 */
interface WalletInfo {
  configured: boolean;
  address: string | null;
  balance: string | null;
  balance_wei?: string | null;
  user_index?: number | null;
  is_smart_account?: boolean | null;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(value);
    return true;
  } catch {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export default function WalletScreen() {
  const { sdk } = useAuth();
  const colors = useColors();
  const [wallet, setWallet] = React.useState<WalletInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [sendTo, setSendTo] = React.useState('');
  const [sendAmount, setSendAmount] = React.useState('');
  const [sending, setSending] = React.useState(false);

  const loadWallet = React.useCallback(async () => {
    if (!sdk) return;
    setLoadError(false);
    setLoading(true);
    try {
      const res = await sdk.wallet.getMyWallet();
      setWallet(res.data as WalletInfo);
    } catch (err) {
      // Don't let a fetch failure masquerade as "no wallet yet".
      captureException(err, { screen: 'wallet' });
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  React.useEffect(() => { loadWallet(); }, [loadWallet]);

  const handleCopyAddress = async () => {
    if (!wallet?.address) return;
    const ok = await copyText(wallet.address);
    showToast(ok ? 'Address copied' : 'Could not copy address', ok ? 'success' : 'error');
  };

  const refreshBalance = async () => {
    if (!sdk) return;
    try {
      const res = await sdk.wallet.getBalance();
      if (res.data) setWallet((prev) => (prev ? { ...prev, ...res.data } : (res.data as WalletInfo)));
    } catch {
      /* non-fatal — hero just keeps its prior value */
    }
  };

  const handleSend = async () => {
    if (!sdk || !sendTo.trim() || !sendAmount.trim()) return;
    setSending(true);
    try {
      await sdk.wallet.send(sendTo.trim(), sendAmount.trim());
      showToast(`Sent ${sendAmount} ETH`, 'success');
      setSendTo('');
      setSendAmount('');
      setSendOpen(false);
      await refreshBalance();
    } catch (err: any) {
      showToast(err?.message || 'Failed to send', 'error');
    } finally {
      setSending(false);
    }
  };

  const inputStyle = {
    backgroundColor: colors.surface,
    borderWidth: borders.hairline,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    color: colors.text,
    ...typography.body,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  } as const;

  return (
    <Container safeTop padded={false}>
      <ScreenHeader title="Wallet" />

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing.xl }}>
          <Skeleton height={150} />
          <Skeleton height={56} />
          <Skeleton height={80} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}>
          {/* Connection status is a small, non-invasive chip — the wallet design
              always renders, whether or not the wallet is reachable/active. */}
          {loadError ? (
            <Pressable
              onPress={loadWallet}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start',
                paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full,
                backgroundColor: colors.errorMuted, opacity: pressed ? 0.7 : 1,
                ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
              })}
            >
              <Ionicons name="cloud-offline-outline" size={13} color={colors.error} />
              <Text variant="caption" color={colors.error}>Couldn't reach your wallet · Tap to retry</Text>
            </Pressable>
          ) : !wallet?.configured ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, backgroundColor: colors.accentMuted }}>
              <Ionicons name="construct-outline" size={13} color={colors.accent} />
              <Text variant="caption" color={colors.accent}>Under construction</Text>
            </View>
          ) : null}

          {/* Hero — MINDS, the network token. Sleek, not bulky. */}
          <Card padding="xl" style={{ alignItems: 'center', gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="flash" size={12} color={colors.textOnAccent} />
              </View>
              <Text variant="label" color={colors.textMuted}>MINDS BALANCE</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs }}>
              <Text variant="hero" color={colors.text}>{wallet?.balance ?? '0'}</Text>
              <Text variant="h3" color={colors.accent}>MINDS</Text>
            </View>

            {wallet?.address && (
              <Pressable
                onPress={handleCopyAddress}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
                  marginTop: spacing.md,
                  paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
                  borderRadius: radius.full, backgroundColor: colors.surfaceHover,
                  opacity: pressed ? 0.7 : 1,
                  ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
                })}
              >
                <Text variant="mono" color={colors.textSecondary} style={{ fontSize: 13 }}>
                  {truncateAddress(wallet.address)}
                </Text>
                <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
              </Pressable>
            )}
          </Card>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <ActionButton icon="arrow-down" label="Receive" onPress={() => setReceiveOpen(true)} colors={colors} />
            <ActionButton icon="arrow-up" label="Send" onPress={() => setSendOpen(true)} colors={colors} />
          </View>

          <Text variant="body" color={colors.textSecondary} style={{ lineHeight: 22, paddingHorizontal: spacing.xs }}>
            Earn MINDS for great posts, spend it to boost your reach, and tip the creators you love. ⚡
          </Text>
        </ScrollView>
      )}

      {/* Receive modal */}
      <Modal visible={receiveOpen} transparent animationType="fade" onRequestClose={() => setReceiveOpen(false)}>
        <Pressable onPress={() => setReceiveOpen(false)} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing['2xl'], width: '100%', maxWidth: 380, borderWidth: borders.thin, borderColor: colors.border, alignItems: 'center', gap: spacing.lg }}>
            <Text variant="h3" color={colors.text}>Receive</Text>
            <Text variant="caption" color={colors.textMuted} align="center">Share your wallet address to receive funds on Base.</Text>
            <View style={{ width: '100%', backgroundColor: colors.surfaceHover, borderRadius: radius.md, padding: spacing.lg }}>
              <Text variant="mono" color={colors.text} align="center" selectable style={{ fontSize: 13, lineHeight: 20 }}>
                {wallet?.address ?? '—'}
              </Text>
            </View>
            <Button onPress={handleCopyAddress} fullWidth>Copy address</Button>
            <Button onPress={() => setReceiveOpen(false)} variant="ghost" fullWidth>Close</Button>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Send modal */}
      <Modal visible={sendOpen} transparent animationType="fade" onRequestClose={() => setSendOpen(false)}>
        <Pressable onPress={() => setSendOpen(false)} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing['2xl'], width: '100%', maxWidth: 380, borderWidth: borders.thin, borderColor: colors.border, gap: spacing.md }}>
            <Text variant="h3" color={colors.text}>Send ETH</Text>
            <Text variant="caption" color={colors.textMuted}>Transfers run on Base. Double-check the recipient address.</Text>
            <TextInput
              placeholder="Recipient address (0x…)"
              placeholderTextColor={colors.textMuted}
              value={sendTo}
              onChangeText={setSendTo}
              autoCapitalize="none"
              autoCorrect={false}
              style={inputStyle}
            />
            <TextInput
              placeholder="Amount (ETH)"
              placeholderTextColor={colors.textMuted}
              value={sendAmount}
              onChangeText={setSendAmount}
              keyboardType="decimal-pad"
              style={inputStyle}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xs }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => setSendOpen(false)} variant="secondary" fullWidth>Cancel</Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button onPress={handleSend} loading={sending} disabled={!sendTo.trim() || !sendAmount.trim()} fullWidth>Send</Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        borderRadius: radius.md,
        backgroundColor: colors.glass,
        borderWidth: borders.hairline,
        borderColor: colors.glassBorder,
        opacity: pressed ? 0.8 : 1,
        ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
      })}
    >
      <Ionicons name={icon} size={18} color={colors.accent} />
      <Text variant="bodyMedium" color={colors.text}>{label}</Text>
    </Pressable>
  );
}
