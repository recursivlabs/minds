import * as React from 'react';
import { View, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { spacing, radius, type ColorTokens } from '../constants/theme';
import { useColors } from '../lib/theme';

// 'gold' = the shared Minds+/Pro membership check, drawn as an X-style scalloped
// seal (gold burst + white check). 'pro' = the extra marker Pro members get ON
// TOP of the seal. 'founder' = WeFunder-era early investors, honored per their
// original deal. 'plus' kept for back-compat (getBadges emits 'gold').
type BadgeType = 'verified' | 'admin' | 'agent' | 'gold' | 'pro' | 'founder' | 'plus';

interface Props {
  type: BadgeType;
  size?: 'sm' | 'md';
}

// Built per-render so accent/accentMuted track the active theme.
function badgeConfig(colors: ColorTokens): Record<BadgeType, { icon: string; color: string; label: string; bg: string }> {
  return {
    // Minds+ AND Pro both wear the gold seal (rendered specially, see GoldSeal).
    gold: { icon: 'checkmark', color: colors.accent, label: 'Minds+', bg: colors.accentMuted },
    // Pro's additional marker — a diamond (premium), shown alongside the seal.
    pro: { icon: 'diamond', color: colors.accent, label: 'Pro', bg: colors.accentMuted },
    // Earliest supporters (WeFunder investors) — an honor ribbon.
    founder: { icon: 'ribbon', color: colors.token, label: 'Founder', bg: colors.tokenMuted },
    verified: { icon: 'checkmark-circle', color: colors.verified, label: 'Verified', bg: colors.verifiedMuted },
    admin: { icon: 'shield', color: colors.accent, label: 'Admin', bg: colors.accentMuted },
    agent: { icon: 'hardware-chip', color: colors.accent, label: 'AI', bg: colors.accentMuted },
    plus: { icon: 'checkmark', color: colors.accent, label: 'Minds+', bg: colors.accentMuted },
  };
}

// X-style verified seal: two overlapping rounded squares (one rotated 45°) form
// an 8-point gold burst, with a white checkmark centered. Pure Views + a glyph —
// no SVG dependency. `size` is the overall diameter; the burst + check scale to it.
function GoldSeal({ size, color }: { size: number; color: string }) {
  const burst = Math.round(size * 0.82);
  const check = Math.round(size * 0.62);
  const square = {
    position: 'absolute' as const,
    width: burst,
    height: burst,
    borderRadius: Math.round(burst * 0.28),
    backgroundColor: color,
  };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={square} />
      <View style={[square, { transform: [{ rotate: '45deg' }] }]} />
      <Ionicons name="checkmark" size={check} color="#ffffff" style={{ zIndex: 1 }} />
    </View>
  );
}

export const Badge = React.memo(function Badge({ type, size = 'sm' }: Props) {
  const colors = useColors();
  const config = badgeConfig(colors)[type];
  if (!config) return null;

  const isSeal = type === 'gold' || type === 'plus';
  const glyph = size === 'sm' ? 14 : 12;

  // Web hover tooltip (Plus / Pro / Founder …) + a11y label on every platform.
  const tip = Platform.OS === 'web' ? ({ title: config.label } as any) : {};
  const wrap = (node: React.ReactNode) => (
    <View accessible accessibilityLabel={config.label} {...tip}
      style={size === 'sm' ? undefined : {
        flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
        backgroundColor: config.bg, paddingHorizontal: spacing.sm, paddingVertical: 2,
        borderRadius: radius.sm,
      }}>
      {node}
    </View>
  );

  const icon = isSeal
    ? <GoldSeal size={glyph} color={config.color} />
    : <Ionicons name={config.icon as any} size={size === 'sm' ? glyph : 12} color={config.color} />;

  if (size === 'sm') return wrap(icon);

  return wrap(
    <>
      {icon}
      <Text variant="caption" color={config.color} style={{ fontSize: 10 }}>{config.label}</Text>
    </>
  );
});

/**
 * Get badge types for a user/agent based on their properties. Order = display
 * order in the byline: gold membership seal first, then the Pro marker, then
 * Founder honor, then verified/admin/agent.
 */
export function getBadges(user: any): BadgeType[] {
  const badges: BadgeType[] = [];
  const isPro = !!(user?.pro || user?.is_pro);
  const isPlus = !!(user?.plus || user?.is_plus);
  // Minds+ AND Pro both get the gold seal.
  if (isPlus || isPro) badges.push('gold');
  // Pro adds a second marker on top of the seal.
  if (isPro) badges.push('pro');
  // Founders (WeFunder investors) — honored per their original deal.
  if (user?.founder || user?.is_founder) badges.push('founder');
  if (user?.verified || user?.is_verified) badges.push('verified');
  if (user?.role === 'admin' || user?.is_admin) badges.push('admin');
  if (user?.isAi || user?.is_ai || user?.type === 'agent') badges.push('agent');
  return badges;
}
