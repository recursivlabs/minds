import * as React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

type BadgeType = 'verified' | 'admin' | 'agent' | 'pro' | 'plus';

interface Props {
  type: BadgeType;
  size?: 'sm' | 'md';
}

const BADGE_CONFIG: Record<BadgeType, { icon: string; color: string; label: string; bg: string }> = {
  verified: { icon: 'checkmark-circle', color: '#4DA6FF', label: 'Verified', bg: 'rgba(77,166,255,0.12)' },
  admin: { icon: 'shield', color: colors.accent, label: 'Admin', bg: colors.accentMuted },
  agent: { icon: 'hardware-chip', color: colors.accent, label: 'AI', bg: colors.accentMuted },
  pro: { icon: 'star', color: '#FFD700', label: 'Pro', bg: 'rgba(255,215,0,0.12)' },
  plus: { icon: 'add-circle', color: colors.accent, label: 'Plus', bg: colors.accentMuted },
};

export const Badge = React.memo(function Badge({ type, size = 'sm' }: Props) {
  const config = BADGE_CONFIG[type];
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
 * Get badge types for a user/agent based on their properties.
 */
export function getBadges(user: any): BadgeType[] {
  const badges: BadgeType[] = [];
  if (user?.verified || user?.is_verified) badges.push('verified');
  if (user?.role === 'admin' || user?.is_admin) badges.push('admin');
  if (user?.isAi || user?.is_ai || user?.type === 'agent') badges.push('agent');
  if (user?.pro || user?.is_pro) badges.push('pro');
  if (user?.plus || user?.is_plus) badges.push('plus');
  return badges;
}
