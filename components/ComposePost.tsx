import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { Avatar } from './Avatar';
import { useAuth } from '../lib/auth';
import { colors, spacing } from '../constants/theme';

interface Props {
  onPost?: (data: { content: string; title?: string; tags: string[] }) => Promise<void>;
  placeholder?: string;
  showTitle?: boolean;
  communityId?: string;
}

export function ComposePost({ placeholder = "What's on your mind?" }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/create')}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        padding: spacing.xl,
        borderBottomWidth: 0.5,
        borderBottomColor: 'rgba(255,255,255,0.06)',
      }}
    >
      <Avatar uri={user?.image} name={user?.name} size="sm" />
      <Text variant="body" color={colors.textMuted} style={{ flex: 1 }}>
        {placeholder}
      </Text>
    </Pressable>
  );
}
