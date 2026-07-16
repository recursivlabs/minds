import * as React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { spacing, radius, type ColorTokens } from '../constants/theme';
import { useColors } from '../lib/theme';

// 'gold' = the shared Minds+/Pro gold checkmark. 'pro' = the extra marker Pro
// members get ON TOP of the gold check. 'founder' = WeFunder-era early investors,
// honored per their original deal. 'plus' kept for back-compat (getBadges no
// longer emits it — Plus now shows the gold check).
type BadgeType = 'verified' | 'admin' | 'agent' | 'gold' | 'pro' | 'founder' | 'plus';

interface Props {
  type: BadgeType;
  size?: 'sm' | 'md';
}

// Built per-render so accent/accentMuted track the active theme.
function badgeConfig(colors: ColorTokens): Record<BadgeType, { icon: string; color: string; label: string; bg: string }> {
  return {
    // Minds+ AND Pro both wear the gold checkmark (accent = Minds gold).
    gold: { icon: 'checkmark-circle', color: colors.accent, label: 'Minds+', bg: colors.accentMuted },
    // Pro's additional marker, shown alongside the gold check.
    pro: { icon: 'star', color: colors.accent, label: 'Pro', bg: colors.accentMuted },
    // Earliest supporters (WeFunder investors) — an honor ribbon.
    founder: { icon: 'ribbon', color: colors.token, label: 'Founder', bg: colors.tokenMuted },
    verified: { icon: 'checkmark-circle', color: colors.verified, label: 'Verified', bg: colors.verifiedMuted },
    admin: { icon: 'shield', color: colors.accent, label: 'Admin', bg: colors.accentMuted },
    agent: { icon: 'hardware-chip', color: colors.accent, label: 'AI', bg: colors.accentMuted },
    plus: { icon: 'checkmark-circle', color: colors.accent, label: 'Minds+', bg: colors.accentMuted },
  };
}

export const Badge = React.memo(function Badge({ type, size = 'sm' }: Props) {
  const colors = useColors();
  const config = badgeConfig(colors)[type];
  if (!config) return null;

  if (size === 'sm') {
    return (
      <Ionicons name={config.icon as any} size={14} color={config.color} />
    );
  }

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
      backgroundColor: config.bg, paddingHorizontal: spacing.sm, paddingVertical: 2,
      borderRadius: radius.sm,
    }}>
      <Ionicons name={config.icon as any} size={12} color={config.color} />
      <Text variant="caption" color={config.color} style={{ fontSize: 10 }}>{config.label}</Text>
    </View>
  );
});

/**
 * Get badge types for a user/agent based on their properties. Order = display
 * order in the byline: gold membership check first, then the Pro marker, then
 * Founder honor, then verified/admin/agent.
 */
export function getBadges(user: any): BadgeType[] {
  const badges: BadgeType[] = [];
  const isPro = !!(user?.pro || user?.is_pro);
  const isPlus = !!(user?.plus || user?.is_plus);
  // Minds+ AND Pro both get the gold checkmark.
  if (isPlus || isPro) badges.push('gold');
  // Pro adds a second marker on top of the gold check.
  if (isPro) badges.push('pro');
  // Founders (WeFunder investors) — honored per their original deal.
  if (user?.founder || user?.is_founder) badges.push('founder');
  if (user?.verified || user?.is_verified) badges.push('verified');
  if (user?.role === 'admin' || user?.is_admin) badges.push('admin');
  if (user?.isAi || user?.is_ai || user?.type === 'agent') badges.push('agent');
  return badges;
}
