import * as React from 'react';
import { View, ScrollView, Pressable, Platform, TextInput, Alert, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text, Avatar, Button, Divider, PostCard, Skeleton } from '../../components';
import { Container } from '../../components/Container';
import { useAuth } from '../../lib/auth';
import { useMyProfile, usePosts } from '../../lib/hooks';
import { colors, spacing, radius, typography } from '../../constants/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const { sdk, user, signOut } = useAuth();
  const { profile, loading: profileLoading, refresh: refreshProfile } = useMyProfile();
  const { posts, loading: postsLoading } = usePosts('latest', 50);

  const [showEditProfile, setShowEditProfile] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editBio, setEditBio] = React.useState('');
  const [editSaving, setEditSaving] = React.useState(false);

  const displayProfile = profile || user;
  const myPosts = posts.filter(
    (p: any) => (p.author?.id || p.userId || p.user_id) === user?.id
  );

  const followerCount = profile?.followerCount || profile?.follower_count || 0;
  const followingCount = profile?.followingCount || profile?.following_count || 0;

  return (
    <Container safeTop padded={false}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile info */}
        <View style={{ paddingTop: spacing['3xl'], paddingHorizontal: spacing.xl }}>
          <Avatar
            uri={displayProfile?.image}
            name={displayProfile?.name}
            size="xl"
          />

          <Text variant="h2" style={{ marginTop: spacing.lg }}>
            {displayProfile?.name || 'User'}
          </Text>
          <Text variant="body" color={colors.textMuted} style={{ marginTop: spacing.xs }}>
            @{displayProfile?.username || displayProfile?.email?.split('@')[0] || 'user'}
          </Text>

          {(displayProfile?.bio || profile?.bio) && (
            <Text
              variant="body"
              color={colors.textSecondary}
              style={{ marginTop: spacing.md, lineHeight: 22 }}
            >
              {displayProfile?.bio || profile?.bio}
            </Text>
          )}

          {/* Stats */}
          <View style={{ flexDirection: 'row', gap: spacing['2xl'], marginTop: spacing.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followingCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Following</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Text variant="bodyMedium">{followerCount}</Text>
              <Text variant="caption" color={colors.textMuted}>Followers</Text>
            </View>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
            <Button
              onPress={() => {
                setEditName(displayProfile?.name || '');
                setEditBio(displayProfile?.bio || profile?.bio || '');
                setShowEditProfile(true);
              }}
              variant="secondary"
              size="sm"
            >
              Edit Profile
            </Button>
            <Button
              onPress={async () => {
                await signOut();
                router.replace('/');
              }}
              variant="ghost"
              size="sm"
            >
              Sign Out
            </Button>
          </View>
        </View>

        <Divider marginVertical={spacing.xl} />

        {/* Posts */}
        {postsLoading ? (
          <View style={{ padding: spacing.xl, gap: spacing.lg }}>
            {[1, 2, 3].map(i => (
              <View key={i} style={{ gap: spacing.sm }}>
                <Skeleton height={14} width={160} />
                <Skeleton height={50} />
              </View>
            ))}
          </View>
        ) : myPosts.length === 0 ? (
          <View style={{ alignItems: 'center', padding: spacing['3xl'], gap: spacing.md }}>
            <Text variant="body" color={colors.textMuted}>
              You haven't posted yet
            </Text>
            <Button onPress={() => router.push('/(tabs)/create')} size="sm">
              Create a post
            </Button>
          </View>
        ) : (
          myPosts.map((post: any) => (
            <PostCard key={post.id} post={post} compact />
          ))
        )}

        <View style={{ height: spacing['4xl'] }} />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={showEditProfile} transparent animationType="fade" onRequestClose={() => setShowEditProfile(false)}>
        <Pressable
          onPress={() => setShowEditProfile(false)}
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
              backgroundColor: '#111',
              borderRadius: radius.xl,
              padding: spacing['2xl'],
              width: '100%',
              maxWidth: 400,
              borderWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text variant="h3" style={{ marginBottom: spacing.xl }}>Edit Profile</Text>

            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Name</Text>
            <TextInput
              value={editName}
              onChangeText={setEditName}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: 10,
                color: colors.text,
                ...typography.body,
                marginBottom: spacing.lg,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />

            <Text variant="label" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>Bio</Text>
            <TextInput
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell people about yourself"
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={3}
              style={{
                backgroundColor: colors.bg,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.md,
                paddingHorizontal: spacing.lg,
                paddingVertical: 10,
                color: colors.text,
                minHeight: 80,
                textAlignVertical: 'top',
                ...typography.body,
                marginBottom: spacing.xl,
                ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as any : {}),
              }}
            />

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Button onPress={() => setShowEditProfile(false)} variant="secondary" fullWidth>
                  Cancel
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  loading={editSaving}
                  onPress={async () => {
                    if (!sdk) return;
                    setEditSaving(true);
                    try {
                      await sdk.profiles.update({ name: editName.trim(), bio: editBio.trim() });
                      await refreshProfile();
                      setShowEditProfile(false);
                    } catch {
                      const msg = 'Failed to update profile.';
                      if (Platform.OS === 'web') alert(msg);
                      else Alert.alert('Error', msg);
                    } finally {
                      setEditSaving(false);
                    }
                  }}
                  fullWidth
                >
                  Save
                </Button>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </Container>
  );
}
