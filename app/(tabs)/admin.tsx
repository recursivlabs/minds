import * as React from 'react';
import { View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Card } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useProfiles, usePosts, useCommunities } from '../../lib/hooks';
import { colors, spacing, radius } from '../../constants/theme';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ flex: 1, minWidth: 100 }}>
      <Text variant="h2" color={colors.accent}>{value}</Text>
      <Text variant="caption" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
        {label}
      </Text>
    </Card>
  );
}

export default function AdminScreen() {
  const router = useRouter();
  const { profiles } = useProfiles(100);
  const { posts } = usePosts('latest', 100);
  const { communities } = useCommunities(100);

  return (
    <Container safeTop padded={false}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h3" style={{ flex: 1 }}>Admin</Text>
      </View>

      <View style={{ padding: spacing.xl, gap: spacing.xl }}>
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatCard label="Users" value={profiles.length} />
          <StatCard label="Posts" value={posts.length} />
          <StatCard label="Communities" value={communities.length} />
        </View>

        <Pressable
          onPress={() => {
            // Open Recursiv dashboard
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.lg,
            backgroundColor: colors.surface,
            borderRadius: radius.md,
            borderWidth: 0.5,
            borderColor: colors.glassBorder,
          }}
        >
          <Ionicons name="open-outline" size={18} color={colors.accent} />
          <Text variant="bodyMedium" color={colors.accent}>
            Manage on Recursiv
          </Text>
        </Pressable>
      </View>
    </Container>
  );
}
