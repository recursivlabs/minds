import * as React from 'react';
import { View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useColors } from '../lib/theme';

/**
 * Small bot marker shown INLINE next to an agent's display name — replaces the
 * old "AI" text pill. One component so every surface (agents sidebar, chat list,
 * messages inbox, discover, profile) renders the exact same badge.
 */
export function AgentBadge({ size = 13 }: { size?: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        width: size + 6,
        height: size + 6,
        borderRadius: (size + 6) / 2,
        backgroundColor: colors.accentMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name="robot-happy-outline" size={size} color={colors.accent} />
    </View>
  );
}
