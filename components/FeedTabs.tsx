import * as React from 'react';
import { View, Pressable, Platform } from 'react-native';
import { Text } from './Text';
import { colors, spacing } from '../constants/theme';

type FeedTab = 'foryou' | 'latest' | 'following' | 'trending';

interface Props {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
  /** Optional unread counts per tab; renders a small accent dot beside the label. */
  unread?: Partial<Record<FeedTab, number>>;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'foryou', label: 'For You' },
  { key: 'trending', label: 'Trending' },
  { key: 'latest', label: 'Latest' },
  { key: 'following', label: 'Following' },
];

export function FeedTabs({ active, onChange, unread }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        paddingHorizontal: spacing.xl,
        gap: spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      {TABS.map(({ key, label }) => {
        const isActive = active === key;
        const count = unread?.[key] || 0;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.xs,
              paddingVertical: spacing.sm,
              borderBottomWidth: 2,
              borderBottomColor: isActive ? colors.accent : 'transparent',
              opacity: pressed ? 0.8 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              ...(Platform.OS === 'web' ? { cursor: 'pointer', transition: 'border-color 0.15s ease' } as any : {}),
            })}
          >
            <Text
              variant={isActive ? 'bodyMedium' : 'body'}
              color={isActive ? colors.accent : colors.textMuted}
              style={{ fontSize: 16, letterSpacing: 0.2 }}
            >
              {label}
            </Text>
            {count > 0 && (
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accent,
                  marginTop: -12,
                }}
              />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
