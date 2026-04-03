import { View, Pressable, Platform } from 'react-native';
import { Text } from './Text';
import { colors, spacing } from '../constants/theme';

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
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.xl,
        backgroundColor: 'transparent',
      }}
    >
      {TABS.map(({ key, label }) => {
        const isActive = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            style={({ pressed }) => ({
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
              borderBottomWidth: isActive ? 1.5 : 0,
              borderBottomColor: isActive ? colors.accent : 'transparent',
              backgroundColor: 'transparent',
              opacity: pressed ? 0.8 : 1,
              ...(Platform.OS === 'web' ? { cursor: 'pointer' } as any : {}),
            })}
          >
            <Text
              variant="caption"
              color={isActive ? colors.accent : colors.textMuted}
              style={{ fontSize: 13, fontWeight: isActive ? '400' : '300' }}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
