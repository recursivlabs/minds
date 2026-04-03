import * as React from 'react';
import { View, ScrollView, Pressable, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Card, Button, Divider, Skeleton, PostCard, Container } from '../../components';
import { useAuth } from '../../lib/auth';
import { usePosts } from '../../lib/hooks';
import { colors, spacing, radius } from '../../constants/theme';

export default function BoostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { sdk, user } = useAuth();
  const { posts } = usePosts('latest', 50);
  const [showCreate, setShowCreate] = React.useState(false);
  const [selectedPostId, setSelectedPostId] = React.useState<string | null>(null);
  const [boostAmount, setBoostAmount] = React.useState(1);

  const myPosts = posts.filter(
    (p: any) => (p.author?.id || p.userId || p.user_id) === user?.id
  );

  const handleCreateBoost = () => {
    // Boost creation placeholder
    setShowCreate(false);
    setSelectedPostId(null);
    setBoostAmount(1);
  };

  return (
    <Container safeTop padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ flex: 1 }}>Boost</Text>
        <Button onPress={() => setShowCreate(true)} size="sm">
          Create Boost
        </Button>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Info card */}
        <Card variant="raised">
          <View style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                backgroundColor: colors.boostMuted,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="rocket" size={24} color={colors.boost} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="h3">Boost Your Content</Text>
              <Text variant="body" color={colors.textSecondary} style={{ marginTop: spacing.xs }}>
                Spend MINDS tokens to get your posts seen by more people.
              </Text>
            </View>
          </View>
        </Card>

        {/* Conversion info */}
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            padding: spacing.xl,
            borderWidth: 1,
            borderColor: colors.borderSubtle,
            flexDirection: 'row',
            justifyContent: 'space-around',
          }}
        >
          <View style={{ alignItems: 'center' }}>
            <Text variant="h2" color={colors.boost}>1</Text>
            <Text variant="caption" color={colors.textMuted}>Token</Text>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="arrow-forward" size={20} color={colors.textMuted} />
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text variant="h2" color={colors.text}>1,000</Text>
            <Text variant="caption" color={colors.textMuted}>Views</Text>
          </View>
        </View>

        <Divider />

        {/* Active boosts */}
        <View>
          <Text variant="h3" style={{ marginBottom: spacing.lg }}>
            Active Boosts
          </Text>
          <Card variant="raised">
            <View style={{ alignItems: 'center', padding: spacing.xl }}>
              <Ionicons name="rocket-outline" size={40} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                No active boosts
              </Text>
              <Text
                variant="caption"
                color={colors.textMuted}
                align="center"
                style={{ marginTop: spacing.xs }}
              >
                Create a boost to amplify your best content
              </Text>
            </View>
          </Card>
        </View>

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* Create Boost Modal */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <Pressable
          onPress={() => setShowCreate(false)}
          style={{
            flex: 1,
            backgroundColor: colors.overlay,
            justifyContent: 'center',
            alignItems: 'center',
            padding: spacing.xl,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: radius.xl,
              padding: spacing['2xl'],
              width: '100%',
              maxWidth: 400,
              maxHeight: '80%',
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="h3" style={{ marginBottom: spacing.xl }}>
              Create a Boost
            </Text>

            {/* Post selector */}
            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
              Select a post to boost
            </Text>

            <ScrollView style={{ maxHeight: 200, marginBottom: spacing.xl }}>
              {myPosts.length === 0 ? (
                <Text variant="body" color={colors.textMuted}>
                  You need to create a post first
                </Text>
              ) : (
                myPosts.slice(0, 10).map((post: any) => (
                  <Pressable
                    key={post.id}
                    onPress={() => setSelectedPostId(post.id)}
                    style={{
                      padding: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: selectedPostId === post.id ? colors.surfaceHover : 'transparent',
                      borderWidth: selectedPostId === post.id ? 1 : 0,
                      borderColor: colors.accent,
                      marginBottom: spacing.xs,
                    }}
                  >
                    <Text variant="body" numberOfLines={2}>
                      {post.content || post.title || 'Post'}
                    </Text>
                  </Pressable>
                ))
              )}
            </ScrollView>

            {/* Token amount */}
            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.md }}>
              Token amount (1-5)
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg }}>
              {[1, 2, 3, 4, 5].map(amount => (
                <Pressable
                  key={amount}
                  onPress={() => setBoostAmount(amount)}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: boostAmount === amount ? colors.boost : colors.surfaceHover,
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: boostAmount === amount ? colors.boost : colors.border,
                  }}
                >
                  <Text
                    variant="bodyMedium"
                    color={boostAmount === amount ? colors.textInverse : colors.text}
                  >
                    {amount}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text variant="caption" color={colors.textMuted} align="center" style={{ marginBottom: spacing.xl }}>
              {boostAmount} token{boostAmount !== 1 ? 's' : ''} = {(boostAmount * 1000).toLocaleString()} estimated views
            </Text>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => setShowCreate(false)} variant="secondary" fullWidth>
                  Cancel
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  onPress={handleCreateBoost}
                  disabled={!selectedPostId}
                  accentColor={colors.boost}
                  fullWidth
                >
                  Boost
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}
