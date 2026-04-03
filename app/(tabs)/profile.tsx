import * as React from 'react';
import { View, ScrollView, Pressable, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Avatar, Card, Button, Divider, PostCard, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useMyProfile, usePosts } from '../../lib/hooks';
import { colors, spacing, radius } from '../../constants/theme';

type ProfileTab = 'posts' | 'communities' | 'agents';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { profile, loading: profileLoading } = useMyProfile();
  const { posts, loading: postsLoading } = usePosts('latest', 20);
  const [activeTab, setActiveTab] = React.useState<ProfileTab>('posts');
  const [showSettings, setShowSettings] = React.useState(false);

  const displayProfile = profile || user;
  const myPosts = posts.filter(
    (p: any) => (p.author?.id || p.userId || p.user_id) === user?.id
  );

  const followerCount = profile?.followerCount || profile?.follower_count || 0;
  const followingCount = profile?.followingCount || profile?.following_count || 0;

  const isWeb = Platform.OS === 'web';

  return (
    <Container safeTop padded={false}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
          borderBottomWidth: 0.5,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Text variant="h2">Profile</Text>
        <Pressable onPress={() => setShowSettings(!showSettings)} hitSlop={8}>
          <Ionicons name="settings-outline" size={22} color={colors.textSecondary} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile info — left aligned */}
        <View style={{ paddingTop: spacing['2xl'], paddingHorizontal: spacing.xl }}>
          {/* Avatar + Name row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
            <Avatar
              uri={displayProfile?.image}
              name={displayProfile?.name}
              size="xl"
            />
            <View style={{ flex: 1 }}>
              <Text variant="h2">
                {displayProfile?.name || 'User'}
              </Text>
              <Text variant="body" color={colors.textMuted} style={{ marginTop: 2 }}>
                @{displayProfile?.username || displayProfile?.email?.split('@')[0] || 'user'}
              </Text>
            </View>
          </View>

          {/* Bio */}
          {(displayProfile?.bio || profile?.bio) && (
            <Text
              variant="body"
              color={colors.textSecondary}
              style={{ marginTop: spacing.lg }}
            >
              {displayProfile?.bio || profile?.bio}
            </Text>
          )}

          {/* Stats row */}
          <View
            style={{
              flexDirection: 'row',
              gap: spacing['2xl'],
              marginTop: spacing.xl,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followerCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Followers</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followingCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{myPosts.length}</Text>
              <Text variant="caption" color={colors.textMuted}>Posts</Text>
            </View>
          </View>

          {/* Action buttons */}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <Button
              onPress={() => {}}
              variant="secondary"
              size={isWeb ? 'sm' : 'md'}
            >
              Edit Profile
            </Button>
            <Button
              onPress={() => setShowSettings(true)}
              variant="secondary"
              size={isWeb ? 'sm' : 'md'}
            >
              Settings
            </Button>
          </View>
        </View>

        {/* Divider */}
        <View style={{ marginTop: spacing.xl }}>
          <Divider />
        </View>

        {/* Content tabs */}
        <View
          style={{
            flexDirection: 'row',
            borderBottomWidth: 0.5,
            borderBottomColor: colors.borderSubtle,
          }}
        >
          {(['posts', 'communities', 'agents'] as ProfileTab[]).map(tab => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: spacing.md,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: activeTab === tab ? colors.accent : 'transparent',
              }}
            >
              <Text
                variant="bodyMedium"
                color={activeTab === tab ? colors.text : colors.textMuted}
                style={{ fontSize: 14, textTransform: 'capitalize' }}
              >
                {tab}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content */}
        {activeTab === 'posts' && (
          postsLoading ? (
            <View style={{ padding: spacing.xl, gap: spacing.lg }}>
              {[1, 2, 3].map(i => (
                <View key={i} style={{ gap: spacing.sm }}>
                  <Skeleton height={14} width={160} />
                  <Skeleton height={50} />
                </View>
              ))}
            </View>
          ) : myPosts.length === 0 ? (
            <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
              <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
              <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
                No posts yet
              </Text>
            </View>
          ) : (
            myPosts.map((post: any) => (
              <PostCard key={post.id} post={post} compact />
            ))
          )
        )}

        {activeTab === 'communities' && (
          <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
              Join communities from the Explore tab
            </Text>
          </View>
        )}

        {activeTab === 'agents' && (
          <View style={{ alignItems: 'center', padding: spacing['4xl'] }}>
            <Ionicons name="sparkles-outline" size={40} color={colors.textMuted} />
            <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.md }}>
              Discover agents from the Explore tab
            </Text>
          </View>
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* Settings overlay */}
      {showSettings && (
        <Pressable
          onPress={() => setShowSettings(false)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: colors.overlay,
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing['2xl'],
              paddingBottom: insets.bottom + spacing['2xl'],
              maxWidth: 600,
              alignSelf: 'center',
              width: '100%',
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: colors.surfaceHover,
                alignSelf: 'center',
                marginBottom: spacing.xl,
              }}
            />
            <Text variant="h3" style={{ marginBottom: spacing.xl }}>Settings</Text>

            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
              <Text variant="body">Edit Profile</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/(tabs)/wallet')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="diamond-outline" size={20} color={colors.textSecondary} />
              <Text variant="body">Wallet</Text>
            </Pressable>

            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.textSecondary} />
              <Text variant="body">Notifications</Text>
            </Pressable>

            <Pressable
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="shield-outline" size={20} color={colors.textSecondary} />
              <Text variant="body">Privacy</Text>
            </Pressable>

            <Divider />

            <Pressable
              onPress={async () => {
                await signOut();
                setShowSettings(false);
                router.replace('/');
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.lg,
              }}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.error} />
              <Text variant="body" color={colors.error}>Sign Out</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      )}
    </Container>
  );
}
