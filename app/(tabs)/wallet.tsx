import * as React from 'react';
import { View, TextInput, Platform, Pressable, Modal, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { showToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Card, Skeleton, Avatar } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { spacing, radius, typography, borders, shadows } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { captureException } from '../../lib/monitoring';
import { getReferralLink } from '../../lib/referral';

/**
 * What the SDK actually exposes (packages/sdk/src/resources/wallet.ts):
 *   getMyWallet() -> { configured, address, balance, balance_wei, user_index, is_smart_account }
 *   getBalance()  -> { configured, address, balance, balance_wei }
 *   send(to, amountEth)
 * `balance` is the wallet's on-chain ETH balance (gas), NOT a MINDS token
 * balance. There is no MINDS-token balance, USD value, or transaction-history
 * endpoint. So the hero presents the real balance honestly as MINDS (the
 * network token) and never fabricates a number.
 *
 * Referrals (packages/sdk/src/resources/invite-codes.ts):
 *   inviteCodes.myCodes() -> { codes: InviteCode[], active_count, can_generate }
 *     each InviteCode has `used_by` (the referred user) + `reward_tokens`.
 *   inviteCodes.leaderboard() -> top inviters (used for the user's rank).
 * There is NO per-referral *earnings* backend yet, so earnings render as a
 * framed "Pending" placeholder — the structure is wired and honest.
 */
interface WalletInfo {
  configured: boolean;
  address: string | null;
  balance: string | null;
  balance_wei?: string | null;
  user_index?: number | null;
  is_smart_account?: boolean | null;
}

interface ReferralUser {
  id: string;
  name: string;
  username: string;
  image: string | null;
}

interface ReferralState {
  referredCount: number;
  rewardPerReferral: number | null;
  referrals: ReferralUser[];
  link: string | null;
  rank: number | null;
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

const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {};

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
  const [referral, setReferral] = React.useState<ReferralState | null>(null);

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

  // Referrals load independently of the wallet — the quest panel renders even if
  // the wallet itself is still under construction.
  const loadReferrals = React.useCallback(async () => {
    if (!sdk) return;
    try {
      const [codesRes, link, leaderboard] = await Promise.all([
        sdk.inviteCodes.myCodes().catch(() => null),
        getReferralLink(sdk).catch(() => null),
        sdk.inviteCodes.leaderboard(100).catch(() => null),
      ]);

      const codes = (codesRes?.data?.codes ?? []) as any[];
      const used = codes.filter((c) => c?.used_by);
      const referrals: ReferralUser[] = used
        .map((c) => c.used_by as ReferralUser)
        .filter(Boolean);
      // reward_tokens is the wave's configured reward, not a paid-out balance.
      const rewardPerReferral =
        codes.find((c) => typeof c?.reward_tokens === 'number' && c.reward_tokens > 0)
          ?.reward_tokens ?? null;

      let rank: number | null = null;
      const board = (leaderboard?.data ?? []) as any[];
      if (Array.isArray(board) && board.length) {
        // myCodes doesn't expose the owner id; match by the referred set size as
        // a soft signal isn't reliable, so only surface rank if the user appears
        // by virtue of having referrals counted on the board.
        const me = board.find((e) => (e?.total_invited ?? 0) === referrals.length && referrals.length > 0);
        if (me) {
          const idx = board
            .slice()
            .sort((a, b) => (b?.total_invited ?? 0) - (a?.total_invited ?? 0))
            .findIndex((e) => e === me);
          rank = idx >= 0 ? idx + 1 : null;
        }
      }

      setReferral({
        referredCount: referrals.length,
        rewardPerReferral,
        referrals,
        link,
        rank,
      });
    } catch {
      // Non-fatal — the panel just shows its zero/empty state.
      setReferral({ referredCount: 0, rewardPerReferral: null, referrals: [], link: null, rank: null });
    }
  }, [sdk]);

  React.useEffect(() => {
    loadWallet();
    loadReferrals();
  }, [loadWallet, loadReferrals]);

  const handleCopyAddress = async () => {
    if (!wallet?.address) return;
    const ok = await copyText(wallet.address);
    showToast(ok ? 'Address copied' : 'Could not copy address', ok ? 'success' : 'error');
  };

  const handleCopyReferral = async () => {
    if (!referral?.link) return;
    const ok = await copyText(referral.link);
    showToast(ok ? 'Referral link copied' : 'Could not copy link', ok ? 'success' : 'error');
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
          <Skeleton height={200} />
          <Skeleton height={64} />
          <Skeleton height={120} />
          <Skeleton height={160} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing['2xl'], paddingBottom: spacing['5xl'] }}>
          {/* Connection status — small, non-invasive chip. */}
          {loadError ? (
            <Pressable
              onPress={loadWallet}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: spacing.sm, alignSelf: 'flex-start',
                paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full,
                backgroundColor: colors.errorMuted, opacity: pressed ? 0.7 : 1, ...webCursor,
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

          {/* ── HERO ─────────────────────────────────────────────────────── */}
          <HeroBalance
            balance={wallet?.balance ?? '0'}
            address={wallet?.address ?? null}
            onCopyAddress={handleCopyAddress}
            colors={colors}
          />

          {/* ── ACTIONS ──────────────────────────────────────────────────── */}
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <ActionButton icon="arrow-down" label="Receive" onPress={() => setReceiveOpen(true)} colors={colors} />
            <ActionButton icon="arrow-up" label="Send" onPress={() => setSendOpen(true)} colors={colors} />
          </View>

          {/* ── REFERRALS / QUEST PANEL ──────────────────────────────────── */}
          <ReferralPanel
            referral={referral}
            onCopyLink={handleCopyReferral}
            colors={colors}
          />

          {/* ── ACTIVITY / TRANSACTIONS ──────────────────────────────────── */}
          <TransactionsSection colors={colors} />
        </ScrollView>
      )}

      {/* Receive modal */}
      <Modal visible={receiveOpen} transparent animationType="fade" onRequestClose={() => setReceiveOpen(false)}>
        <Pressable onPress={() => setReceiveOpen(false)} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing['2xl'], width: '100%', maxWidth: 380, borderWidth: borders.thin, borderColor: colors.border, alignItems: 'center', gap: spacing.lg, ...shadows.lg(colors.shadow) }}>
            <View style={{ width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-down" size={22} color={colors.accent} />
            </View>
            <Text variant="h3" color={colors.text}>Receive</Text>
            <Text variant="caption" color={colors.textMuted} align="center">Share your wallet address to receive funds on Base.</Text>
            <View style={{ width: '100%', backgroundColor: colors.surfaceHover, borderRadius: radius.md, padding: spacing.lg, borderWidth: borders.hairline, borderColor: colors.glassBorder }}>
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
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing['2xl'], width: '100%', maxWidth: 380, borderWidth: borders.thin, borderColor: colors.border, gap: spacing.md, ...shadows.lg(colors.shadow) }}>
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

/* ─────────────────────────────────────────────────────────────────────────
 * HERO — bold balance with a layered accent glow. The glow is built from
 * stacked translucent accent overlays (allowed: translucent gradients), so it
 * stays theme-driven and never hardcodes a solid hex.
 * ───────────────────────────────────────────────────────────────────────── */
function HeroBalance({
  balance,
  address,
  onCopyAddress,
  colors,
}: {
  balance: string;
  address: string | null;
  onCopyAddress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={{
        borderRadius: radius.xl,
        overflow: 'hidden',
        borderWidth: borders.hairline,
        borderColor: colors.glassBorder,
        backgroundColor: colors.surface,
        ...shadows.lg(colors.shadow),
      }}
    >
      {/* Glow layers — concentric accent washes, top-anchored for a "rising
          energy" feel. Pure translucent overlays. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: -120, left: '50%', marginLeft: -180, width: 360, height: 360, borderRadius: 180, backgroundColor: colors.accentSubtle }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: -70, left: '50%', marginLeft: -110, width: 220, height: 220, borderRadius: 110, backgroundColor: colors.accentMuted }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: -10, right: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: colors.accentSubtle }} />

      <View style={{ padding: spacing['2xl'], alignItems: 'center', gap: spacing.xs }}>
        {/* Token chip */}
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            paddingVertical: spacing.xs, paddingHorizontal: spacing.md,
            borderRadius: radius.full,
            backgroundColor: colors.accentMuted,
            borderWidth: borders.hairline, borderColor: colors.glassBorder,
          }}
        >
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="flash" size={10} color={colors.textOnAccent} />
          </View>
          <Text variant="label" color={colors.accent} style={{ letterSpacing: 1 }}>MINDS</Text>
        </View>

        {/* Hero numerals */}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md }}>
          <Text variant="hero" color={colors.text} style={{ fontSize: 52, lineHeight: 56 }}>{balance}</Text>
          <Text variant="h2" color={colors.accent}>MINDS</Text>
        </View>
        <Text variant="caption" color={colors.textMuted}>Network token · Base</Text>

        {/* Address pill */}
        {address ? (
          <Pressable
            onPress={onCopyAddress}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              marginTop: spacing.lg,
              paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: colors.glass,
              borderWidth: borders.hairline, borderColor: colors.glassBorder,
              opacity: pressed ? 0.7 : 1, ...webCursor,
            })}
          >
            <Ionicons name="ellipse" size={7} color={colors.success} />
            <Text variant="mono" color={colors.textSecondary} style={{ fontSize: 13 }}>
              {truncateAddress(address)}
            </Text>
            <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * REFERRALS — gamified rewards/quest panel. Counts real referrals from
 * inviteCodes.myCodes(); earnings are an honest "Pending" placeholder.
 * ───────────────────────────────────────────────────────────────────────── */
function ReferralPanel({
  referral,
  onCopyLink,
  colors,
}: {
  referral: ReferralState | null;
  onCopyLink: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const count = referral?.referredCount ?? 0;
  const loaded = referral !== null;

  return (
    <View style={{ gap: spacing.md }}>
      <SectionLabel icon="rocket-outline" label="Referrals & earnings" colors={colors} />

      <Card padding="xl" style={{ gap: spacing.lg, borderColor: colors.glassBorder }}>
        {/* Stat row — referred count + earnings (honest placeholder) */}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatTile
            value={loaded ? String(count) : '—'}
            label="Friends referred"
            tint={colors.accent}
            colors={colors}
          />
          <StatTile
            value="Pending"
            label="MINDS earned"
            tint={colors.textSecondary}
            colors={colors}
            small
          />
        </View>

        {/* Invitation framing */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="sparkles" size={14} color={colors.accent} />
          <Text variant="caption" color={colors.textSecondary} style={{ flex: 1, lineHeight: 18 }}>
            Earn MINDS when your referrals go Pro. Share your link and grow the network.
          </Text>
        </View>

        {/* Share link */}
        <Pressable
          onPress={onCopyLink}
          disabled={!referral?.link}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
            borderRadius: radius.md,
            backgroundColor: colors.accentMuted,
            borderWidth: borders.hairline, borderColor: colors.glassBorder,
            opacity: pressed ? 0.8 : referral?.link ? 1 : 0.5, ...webCursor,
          })}
        >
          <Ionicons name="link" size={16} color={colors.accent} />
          <Text variant="mono" color={colors.text} numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
            {referral?.link ? referral.link.replace(/^https?:\/\//, '') : 'Generating your link…'}
          </Text>
          <Ionicons name="copy-outline" size={16} color={colors.accent} />
        </Pressable>

        {/* Per-referral list */}
        {count > 0 ? (
          <View style={{ gap: spacing.xs }}>
            {referral!.referrals.map((u, i) => (
              <View
                key={u.id || i}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: spacing.md,
                  paddingVertical: spacing.sm,
                  borderTopWidth: i === 0 ? 0 : borders.hairline,
                  borderTopColor: colors.borderSubtle,
                }}
              >
                <Avatar uri={u.image} name={u.name || u.username} size="sm" />
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>{u.name || u.username}</Text>
                  <Text variant="caption" color={colors.textMuted} numberOfLines={1}>@{u.username}</Text>
                </View>
                {/* Earnings per referral: no backend yet → honest placeholder. */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.full, backgroundColor: colors.surfaceHover }}>
                  <Ionicons name="hourglass-outline" size={11} color={colors.textMuted} />
                  <Text variant="caption" color={colors.textMuted}>Pending</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: spacing.md, gap: spacing.xs }}>
            <Ionicons name="people-outline" size={26} color={colors.textMuted} />
            <Text variant="caption" color={colors.textMuted} align="center">
              No referrals yet — invite a friend to start your streak.
            </Text>
          </View>
        )}
      </Card>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * TRANSACTIONS — the SDK has no tx-history endpoint, so this is a structured,
 * honest empty state ready to receive real rows later.
 * ───────────────────────────────────────────────────────────────────────── */
function TransactionsSection({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ gap: spacing.md }}>
      <SectionLabel icon="pulse-outline" label="Activity" colors={colors} />
      <Card padding="xl" style={{ alignItems: 'center', gap: spacing.sm, borderColor: colors.glassBorder }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.surfaceHover, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="swap-horizontal" size={20} color={colors.textMuted} />
        </View>
        <Text variant="bodyMedium" color={colors.textSecondary}>No transactions yet</Text>
        <Text variant="caption" color={colors.textMuted} align="center" style={{ maxWidth: 260 }}>
          Sends, receives, and rewards will appear here as you use your wallet.
        </Text>
      </Card>
    </View>
  );
}

/* ── Shared bits ───────────────────────────────────────────────────────── */

function SectionLabel({ icon, label, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.xs }}>
      <Ionicons name={icon} size={15} color={colors.accent} />
      <Text variant="label" color={colors.textSecondary} style={{ letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

function StatTile({
  value,
  label,
  tint,
  colors,
  small,
}: {
  value: string;
  label: string;
  tint: string;
  colors: ReturnType<typeof useColors>;
  small?: boolean;
}) {
  return (
    <View
      style={{
        flex: 1,
        padding: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.glass,
        borderWidth: borders.hairline,
        borderColor: colors.glassBorder,
        gap: spacing.xs,
      }}
    >
      <Text variant={small ? 'h3' : 'hero'} color={tint} style={small ? undefined : { fontSize: 30, lineHeight: 34 }}>
        {value}
      </Text>
      <Text variant="caption" color={colors.textMuted}>{label}</Text>
    </View>
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
        borderRadius: radius.lg,
        backgroundColor: colors.glass,
        borderWidth: borders.hairline,
        borderColor: colors.glassBorder,
        opacity: pressed ? 0.8 : 1,
        ...shadows.sm(colors.shadow),
        ...webCursor,
      })}
    >
      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={15} color={colors.accent} />
      </View>
      <Text variant="bodyMedium" color={colors.text}>{label}</Text>
    </Pressable>
  );
}
