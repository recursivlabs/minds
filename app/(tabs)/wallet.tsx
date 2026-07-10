import * as React from 'react';
import { View, TextInput, Platform, Pressable, Modal, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { showToast } from '../../components/Toast';
import { Ionicons } from '@expo/vector-icons';
import { Text, Button, Skeleton, Avatar, RightRailLayout } from '../../components';
import { Container } from '../../components/Container';
import { ScreenHeader } from '../../components/ScreenHeader';
import { useAuth } from '../../lib/auth';
import { spacing, radius, typography, borders, shadows } from '../../constants/theme';
import { useColors } from '../../lib/theme';
import { captureException } from '../../lib/monitoring';
import { getReferralLink } from '../../lib/referral';

/**
 * Minds 2.0 — Wallet
 *
 * Design intent: "minimalist but effective — clean, organized, financial."
 * The screen reads top-to-bottom like a bank statement:
 *   1. HERO        — one big, honest balance in tabular figures. No chrome.
 *   2. ACTIONS     — Receive · Send · Boost as clean icon-stack buttons.
 *   3. ACCOUNT     — one tidy line: address + network, copy to clipboard.
 *   4. REFERRALS   — a restrained earnings ledger (real count, honest pending).
 *   5. ACTIVITY    — a FlatList of statement-style rows (in/out, amount, date).
 *
 * Gold is used sparingly — for the token mark, the primary "Send" action, and
 * positive accents only. Everything else is neutral so the numbers lead.
 *
 * Data reality (packages/sdk/src/resources/wallet.ts):
 *   getMyWallet() -> { configured, address, balance, balance_wei, is_smart_account }
 *   getBalance()  -> refresh; send(to, amountEth) -> ETH transfer on Base.
 * `balance` is the wallet's on-chain balance (the network token), presented
 * honestly as MINDS. There is NO USD value or tx-history endpoint yet, so the
 * activity list ships as a real, statement-shaped empty state (see DATA GAPS in
 * the rationale) and never fabricates rows or a fiat figure.
 *
 * Referrals (packages/sdk/src/resources/invite-codes.ts):
 *   inviteCodes.myCodes() -> codes[] with used_by + reward_tokens.
 * Per-referral *payout* has no backend → rendered as an honest "Pending".
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

/** A statement row. The list is empty today, but the shape is real so wiring a
 *  tx-history endpoint later is a drop-in. */
interface ActivityItem {
  id: string;
  direction: 'in' | 'out';
  title: string;
  subtitle: string;
  amount: string;
  date: string;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Split a decimal balance into integer + fractional parts so the hero can
 *  de-emphasise the fraction (the fintech "big dollars, small cents" move). */
function splitBalance(raw: string | null | undefined): { whole: string; frac: string } {
  const value = (raw ?? '0').trim() || '0';
  const [intPart, fracPartRaw = ''] = value.split('.');
  // Group the integer part with thin separators for legibility at scale.
  const whole = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // Keep up to 4 significant fractional digits — enough precision, no noise.
  const frac = fracPartRaw.replace(/0+$/, '').slice(0, 4);
  return { whole, frac };
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
const tabular = { fontVariant: ['tabular-nums'] as any };

export default function WalletScreen() {
  const { sdk } = useAuth();
  const colors = useColors();
  const router = useRouter();
  const [wallet, setWallet] = React.useState<WalletInfo | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState(false);
  const [receiveOpen, setReceiveOpen] = React.useState(false);
  const [sendOpen, setSendOpen] = React.useState(false);
  const [sendTo, setSendTo] = React.useState('');
  const [sendAmount, setSendAmount] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [referral, setReferral] = React.useState<ReferralState | null>(null);
  const [txFilter, setTxFilter] = React.useState<'all' | 'in' | 'out'>('all');

  // No tx-history endpoint yet — see DATA GAPS. Kept as state so the list is a
  // true FlatList and rows light up the moment a backend lands.
  const activity: ActivityItem[] = [];
  const filteredActivity = txFilter === 'all' ? activity : activity.filter((a) => a.direction === txFilter);

  const loadWallet = React.useCallback(async () => {
    if (!sdk) return;
    setLoadError(false);
    setLoading(true);
    try {
      const res = await sdk.wallet.getMyWallet();
      setWallet(res.data as WalletInfo);
    } catch (err) {
      captureException(err, { screen: 'wallet' });
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sdk]);

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
      const rewardPerReferral =
        codes.find((c) => typeof c?.reward_tokens === 'number' && c.reward_tokens > 0)
          ?.reward_tokens ?? null;

      let rank: number | null = null;
      const board = (leaderboard?.data ?? []) as any[];
      if (Array.isArray(board) && board.length) {
        const me = board.find((e) => (e?.total_invited ?? 0) === referrals.length && referrals.length > 0);
        if (me) {
          const idx = board
            .slice()
            .sort((a, b) => (b?.total_invited ?? 0) - (a?.total_invited ?? 0))
            .findIndex((e) => e === me);
          rank = idx >= 0 ? idx + 1 : null;
        }
      }

      setReferral({ referredCount: referrals.length, rewardPerReferral, referrals, link, rank });
    } catch {
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
      /* non-fatal */
    }
  };

  const handleSend = async () => {
    if (!sdk || !sendTo.trim() || !sendAmount.trim()) return;
    setSending(true);
    try {
      await sdk.wallet.send(sendTo.trim(), sendAmount.trim());
      showToast(`Sent ${sendAmount} MINDS`, 'success');
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
    backgroundColor: colors.bg,
    borderWidth: borders.thin,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    color: colors.text,
    ...typography.body,
    ...tabular,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}),
  } as const;

  /* The whole screen is a single FlatList so the activity ledger stays
     virtualized; everything above it rides in the list header. */
  const balanceDisplay = (() => {
    const { whole, frac } = splitBalance(wallet?.balance ?? '0');
    return frac ? `${whole}.${frac}` : whole;
  })();

  const header = (
    <View style={{ paddingTop: spacing.lg, gap: spacing.xl }}>
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
      ) : null}

      {/* Balance + Send/Receive — one clean line, no wasted vertical space. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.lg, flexWrap: 'wrap' }}>
        <View>
          <Text variant="caption" color={colors.textMuted}>Balance</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: 2 }}>
            <Text variant="h1" color={colors.text} style={{ ...tabular }}>{balanceDisplay}</Text>
            <Text variant="bodyMedium" color={colors.textMuted}>MINDS</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => setSendOpen(true)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full,
              backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1, ...webCursor,
            })}
          >
            <Ionicons name="arrow-up" size={16} color={colors.textOnAccent} />
            <Text variant="bodyMedium" color={colors.textOnAccent}>Send</Text>
          </Pressable>
          <Pressable
            onPress={() => setReceiveOpen(true)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
              paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full,
              backgroundColor: colors.surface, borderWidth: 0.5, borderColor: colors.borderSubtle,
              opacity: pressed ? 0.85 : 1, ...webCursor,
            })}
          >
            <Ionicons name="arrow-down" size={16} color={colors.text} />
            <Text variant="bodyMedium" color={colors.text}>Receive</Text>
          </Pressable>
        </View>
      </View>

      {/* Activity + filter */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm }}>
        <SectionLabel label="Activity" colors={colors} />
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {(['all', 'in', 'out'] as const).map((f) => (
            <Pressable
              key={f}
              onPress={() => setTxFilter(f)}
              style={({ pressed }) => ({
                paddingHorizontal: spacing.md, paddingVertical: 5, borderRadius: radius.full,
                backgroundColor: txFilter === f ? colors.accentMuted : 'transparent',
                borderWidth: 0.5, borderColor: txFilter === f ? colors.accent : colors.borderSubtle,
                opacity: pressed ? 0.7 : 1, ...webCursor,
              })}
            >
              <Text variant="caption" color={txFilter === f ? colors.accent : colors.textMuted}>
                {f === 'all' ? 'All' : f === 'in' ? 'Received' : 'Sent'}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  return (
    <Container safeTop padded={false}>
      <RightRailLayout context="wallet">
      <ScreenHeader title="Wallet" />

      {loading ? (
        <View style={{ padding: spacing.xl, gap: spacing['3xl'] }}>
          <Skeleton height={140} />
          <Skeleton height={72} />
          <Skeleton height={56} />
          <Skeleton height={160} />
        </View>
      ) : (
        <FlatList
          data={filteredActivity}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ActivityRow item={item} colors={colors} />}
          ListHeaderComponent={header}
          ListEmptyComponent={<ActivityEmpty colors={colors} />}
          ItemSeparatorComponent={() => (
            <View style={{ height: borders.hairline, backgroundColor: colors.borderSubtle, marginLeft: 52 }} />
          )}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing['6xl'] }}
          showsVerticalScrollIndicator={false}
        />
      )}
      </RightRailLayout>

      {/* Receive modal */}
      <Modal visible={receiveOpen} transparent animationType="fade" onRequestClose={() => setReceiveOpen(false)}>
        <Pressable onPress={() => setReceiveOpen(false)} style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', alignItems: 'center', padding: spacing.xl }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing['2xl'], width: '100%', maxWidth: 380, borderWidth: borders.thin, borderColor: colors.border, alignItems: 'center', gap: spacing.lg, ...shadows.lg(colors.shadow) }}>
            <View style={{ width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="arrow-down" size={22} color={colors.accent} />
            </View>
            <Text variant="h3" color={colors.text}>Receive</Text>
            <Text variant="caption" color={colors.textMuted} align="center">Share your wallet address to receive funds on Base.</Text>
            <View style={{ width: '100%', backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing.lg, borderWidth: borders.hairline, borderColor: colors.border }}>
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
            <Text variant="h3" color={colors.text}>Send MINDS</Text>
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
              placeholder="Amount"
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
 * HERO — the balance is the screen. No card, no glow, no border: a flat,
 * full-bleed number in tabular figures so digits never jitter. The fraction
 * is de-emphasised (smaller, muted) — the "big dollars, small cents" pattern
 * every premium finance app uses. Gold appears only on the small MINDS mark.
 * ───────────────────────────────────────────────────────────────────────── */
function HeroBalance({ balance, colors }: { balance: string; colors: ReturnType<typeof useColors> }) {
  const { whole, frac } = splitBalance(balance);
  return (
    <View style={{ gap: spacing.sm }}>
      {/* Eyebrow */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="flash" size={10} color={colors.textOnAccent} />
        </View>
        <Text variant="label" color={colors.textSecondary} style={{ letterSpacing: 1 }}>MINDS BALANCE</Text>
      </View>

      {/* The number */}
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text
          variant="hero"
          color={colors.text}
          style={{ fontSize: 56, lineHeight: 60, letterSpacing: -1.5, ...tabular }}
        >
          {whole}
        </Text>
        {frac ? (
          <Text
            variant="hero"
            color={colors.textMuted}
            style={{ fontSize: 32, lineHeight: 44, letterSpacing: -0.5, ...tabular }}
          >
            .{frac}
          </Text>
        ) : null}
      </View>

      <Text variant="caption" color={colors.textMuted}>Network token · Base</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * ACTION BUTTON — icon-stack (icon over label), the fintech standard. One is
 * marked `primary` (Send) and fills with gold; the rest stay neutral surfaces.
 * ───────────────────────────────────────────────────────────────────────── */
function ActionButton({
  icon,
  label,
  onPress,
  colors,
  primary,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
  primary?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: primary ? colors.accent : colors.surface,
        borderWidth: primary ? 0 : borders.hairline,
        borderColor: colors.border,
        opacity: pressed ? 0.85 : 1,
        ...(primary ? shadows.sm(colors.shadow) : {}),
        ...webCursor,
      })}
    >
      <View
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: primary ? 'rgba(255,255,255,0.22)' : colors.accentMuted,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={18} color={primary ? colors.textOnAccent : colors.accent} />
      </View>
      <Text variant="label" color={primary ? colors.textOnAccent : colors.text}>{label}</Text>
    </Pressable>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * ACCOUNT ROW — one organized line: a live dot, the truncated address in mono,
 * the network, and a copy affordance. Reads like an account number.
 * ───────────────────────────────────────────────────────────────────────── */
function AccountRow({
  address,
  onCopy,
  colors,
}: {
  address: string | null;
  onCopy: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onCopy}
      disabled={!address}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md,
        paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: borders.hairline, borderColor: colors.border,
        opacity: pressed ? 0.8 : 1, ...webCursor,
      })}
    >
      <Ionicons name={address ? 'ellipse' : 'ellipse-outline'} size={8} color={address ? colors.success : colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="caption" color={colors.textMuted}>Account</Text>
        <Text variant="mono" color={colors.text} style={{ fontSize: 14 }}>
          {address ? truncateAddress(address) : 'Not yet created'}
        </Text>
      </View>
      {address ? <Ionicons name="copy-outline" size={16} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * REFERRAL LEDGER — restrained earnings strip. Two figures (referred · earned),
 * a single share line. No avatars wall, no quest gamification — just the ledger.
 * ───────────────────────────────────────────────────────────────────────── */
function ReferralLedger({
  referral,
  onCopyLink,
  colors,
}: {
  referral: ReferralState | null;
  onCopyLink: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const loaded = referral !== null;
  const count = referral?.referredCount ?? 0;

  return (
    <View style={{ gap: spacing.md }}>
      <SectionLabel label="Earn" colors={colors} />

      <View
        style={{
          borderRadius: radius.lg,
          borderWidth: borders.hairline,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
        }}
      >
        {/* Figures */}
        <View style={{ flexDirection: 'row' }}>
          <LedgerFigure value={loaded ? String(count) : '—'} label="Referred" colors={colors} />
          <View style={{ width: borders.hairline, backgroundColor: colors.borderSubtle }} />
          <LedgerFigure value="Pending" label="MINDS earned" muted colors={colors} />
        </View>

        <View style={{ height: borders.hairline, backgroundColor: colors.borderSubtle }} />

        {/* Share line */}
        <Pressable
          onPress={onCopyLink}
          disabled={!referral?.link}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
            opacity: pressed ? 0.7 : referral?.link ? 1 : 0.5, ...webCursor,
          })}
        >
          <Ionicons name="link" size={15} color={colors.accent} />
          <Text variant="mono" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
            {referral?.link ? referral.link.replace(/^https?:\/\//, '') : 'Generating your link…'}
          </Text>
          <Ionicons name="copy-outline" size={15} color={colors.textMuted} />
        </Pressable>
      </View>

      <Text variant="caption" color={colors.textMuted} style={{ paddingHorizontal: spacing.xs }}>
        Earn MINDS when the people you invite go Pro.
      </Text>
    </View>
  );
}

function LedgerFigure({
  value,
  label,
  colors,
  muted,
}: {
  value: string;
  label: string;
  colors: ReturnType<typeof useColors>;
  muted?: boolean;
}) {
  return (
    <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: 2 }}>
      <Text variant="h2" color={muted ? colors.textMuted : colors.text} style={{ ...tabular }}>{value}</Text>
      <Text variant="caption" color={colors.textMuted}>{label}</Text>
    </View>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
 * ACTIVITY — statement-style rows. Empty today (no tx-history endpoint), but
 * the row is the real component so a backend lights it up with zero rework.
 * ───────────────────────────────────────────────────────────────────────── */
function ActivityRow({ item, colors }: { item: ActivityItem; colors: ReturnType<typeof useColors> }) {
  const isIn = item.direction === 'in';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md }}>
      <View
        style={{
          width: 36, height: 36, borderRadius: 18,
          backgroundColor: isIn ? colors.successMuted : colors.surfaceHover,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name={isIn ? 'arrow-down' : 'arrow-up'} size={16} color={isIn ? colors.success : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyMedium" color={colors.text} numberOfLines={1}>{item.title}</Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text variant="bodyMedium" color={isIn ? colors.success : colors.text} style={{ ...tabular }}>
          {isIn ? '+' : '−'}{item.amount}
        </Text>
        <Text variant="caption" color={colors.textMuted} style={{ ...tabular }}>{item.date}</Text>
      </View>
    </View>
  );
}

function ActivityEmpty({ colors }: { colors: ReturnType<typeof useColors> }) {
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing['3xl'] }}>
      <View style={{ width: 44, height: 44, borderRadius: radius.full, backgroundColor: colors.surfaceHover, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="receipt-outline" size={20} color={colors.textMuted} />
      </View>
      <Text variant="bodyMedium" color={colors.textSecondary}>No activity yet</Text>
      <Text variant="caption" color={colors.textMuted} align="center" style={{ maxWidth: 260 }}>
        Sends, receives, and rewards will appear here as a running statement.
      </Text>
    </View>
  );
}

/* ── Shared ─────────────────────────────────────────────────────────────── */

function SectionLabel({ label, colors }: { label: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text variant="label" color={colors.textMuted} style={{ letterSpacing: 0.8, textTransform: 'uppercase' as const }}>
      {label}
    </Text>
  );
}
