import { View, Pressable, Platform } from 'react-native';
import { Text } from './Text';
import { colors, spacing, radius } from '../constants/theme';

type FeedTab = 'foryou' | 'latest' | 'following';

interface Props {
  active: FeedTab;
  onChange: (tab: FeedTab) => void;
}

const TABS: { key: FeedTab; label: string }[] = [
  { key: 'foryou', label: 'For You' },
  { key: 'latest', label: 'Latest' },
  { key: 'following', label: 'Following' },
];

export function FeedTabs({ active, onChange }: Props) {
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: spacing.xs,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
      }}
    >
      {TABS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.sm,
              borderRadius: radius.full,
              backgroundColor: isActive ? colors.accent : 'transparent',
              opacity: pressed ? 0.8 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Text
              variant="bodyMedium"
              color={isActive ? '#fff' : colors.textMuted}
              style={{ fontSize: 14 }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
